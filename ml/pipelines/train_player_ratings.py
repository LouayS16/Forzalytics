"""
train_player_ratings.py
Production training pipeline faithfully adapted from player_ratings.ipynb.
Trains player performance rating models and exports all artifacts required by
the Forzalytics backend service (ml/models/ and ml/data/).

Pipeline Architecture:
- Chronological Split: Train (<= 2020), Conformal Calibration (2021), Test (>= 2022)
- Feature Engineering (Shift(1) to avoid data leakage):
  * Rolling ratings (L3, L5, L10)
  * Form volatility (rating_std_5)
  * Form momentum (rating_last_3 - rating_last_10)
  * Workload proxy (days_since_last_match)
  * Context: is_home, opponent, one-hot encoded positions
- Two-Model Routing System:
  * Model A: Starter Expert (XGBRegressor max_depth=5, lr=0.1, n_est=100)
  * Model B: Substitute Expert (XGBRegressor max_depth=3, lr=0.1, n_est=100)
  * Role Classifier: XGBClassifier for automatic role prediction
- Conformal Prediction:
  * Finite-sample-corrected quantile q_hat on 2021 validation set (90% target coverage)
- Similarity Engine:
  * StandardScaler + NearestNeighbors (KNN k=3, euclidean metric)
- Artifact Exports:
  * ml/models/player_ratings.joblib (Models, scaler, KNN, config, metrics)
  * ml/data/upcoming_matches.csv (Test fixtures)
  * ml/data/historical_matches.csv (Historical contexts for similarity search)

Run:
    py ml/pipelines/train_player_ratings.py
"""
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler
import xgboost as xgb

ROOT_DIR = Path(__file__).resolve().parents[2]
MODELS_DIR = ROOT_DIR / "ml" / "models"
DATA_DIR = ROOT_DIR / "ml" / "data"

# Candidate dataset paths
DATASET_CANDIDATES = [
    DATA_DIR / "ratings.csv",
    ROOT_DIR / "ratings.csv",
    ROOT_DIR.parent / "ratings.csv",
]

SEED = 42
TRAIN_END_YEAR = 2020
CALIB_YEAR = 2021
TEST_START_YEAR = 2022
ALPHA = 0.10  # 90% prediction intervals

FORM_FEATURES = [
    "rating_last_3",
    "rating_last_5",
    "rating_last_10",
    "days_since_last_match",
    "rating_std_5",
    "momentum",
]


def resolve_ratings_path() -> Path:
    for p in DATASET_CANDIDATES:
        if p.exists():
            return p
    raise FileNotFoundError(
        f"ratings.csv not found in any expected location: {[str(p) for p in DATASET_CANDIDATES]}"
    )


def past_rolling(df: pd.DataFrame, window: int, stat: str, min_periods: int) -> pd.Series:
    """
    Rolling statistic over a player's previous matches only.
    shift(1) strictly excludes the current match to prevent data leakage.
    """
    return df.groupby("player")["rating"].transform(
        lambda s: getattr(s.shift(1).rolling(window, min_periods=min_periods), stat)()
    )


def extract_features(df_clean: pd.DataFrame):
    """
    Builds time-aware features exactly as defined in player_ratings.ipynb (Cell 8).
    """
    print("Computing player rolling metrics, workload, and context...")
    df = df_clean.sort_values(by=["player", "datetime"]).copy()

    # 1. Form rolling metrics
    df["rating_last_3"] = past_rolling(df, 3, "mean", 1)
    df["rating_last_5"] = past_rolling(df, 5, "mean", 1)
    df["rating_last_10"] = past_rolling(df, 10, "mean", 5)
    df["rating_std_5"] = past_rolling(df, 5, "std", 3)  # volatility
    df["momentum"] = df["rating_last_3"] - df["rating_last_10"]  # short- vs long-term form

    # 2. Workload proxy: days since player's last match
    df["days_since_last_match"] = df.groupby("player")["datetime"].diff().dt.days

    # 3. Contextual features
    df["is_home"] = (df["home_or_away"].astype(str).str.lower().str.contains("home")).astype(int)

    # Opponent derivation
    if "away_team" in df.columns and "home_team" in df.columns:
        df["opponent"] = np.where(df["is_home"] == 1, df["away_team"], df["home_team"])
    else:
        df["opponent"] = "Adversaire"

    df["year"] = df["datetime"].dt.year

    # 4. Filter matches with insufficient rolling history
    df = df.dropna(subset=["rating_last_10", "days_since_last_match", "rating_std_5"]).copy()

    # 5. One-hot encode position
    df = pd.get_dummies(df, columns=["position"], drop_first=False, dtype=int)

    # Starter vs Substitute indicator (position_Sub -> is_starter)
    if "position_Sub" in df.columns:
        df["is_starter"] = (df["position_Sub"] == 0).astype(int)
        df_master = df.drop(columns=["position_Sub"]).reset_index(drop=True)
    else:
        df["is_starter"] = 1
        df_master = df.reset_index(drop=True)

    position_cols = sorted([c for c in df_master.columns if c.startswith("position_")])
    all_features = FORM_FEATURES + ["is_home"] + position_cols

    return df_master, all_features, position_cols


def conformal_margin(residuals: np.ndarray, alpha: float = 0.10) -> float:
    """
    Finite-sample-corrected quantile of absolute calibration errors (from notebook Cell 18).
    """
    n = len(residuals)
    level = min(1.0, np.ceil((n + 1) * (1 - alpha)) / n)
    return float(np.quantile(residuals, level, method="higher"))


def main():
    print("=" * 60)
    print("Forzalytics ML Pipeline: Player Ratings Predictor")
    print("=" * 60)

    dataset_path = resolve_ratings_path()
    print(f"Loading raw dataset from {dataset_path} ...")
    raw_df = pd.read_csv(dataset_path)
    print(f"Loaded {len(raw_df):,} rows.")

    # Clean missing ratings and standardize dates
    raw_df.columns = raw_df.columns.str.strip()
    df_clean = raw_df.dropna(subset=["rating"]).copy()
    df_clean["datetime"] = pd.to_datetime(df_clean["datetime"])

    # Feature engineering
    df_master, all_features, position_cols = extract_features(df_clean)
    print(f"Features engineered: {len(all_features)} features, {len(df_master):,} valid matches.")

    # Chronological Split
    train_data = df_master[df_master["year"] <= TRAIN_END_YEAR].copy()
    calib_data = df_master[df_master["year"] == CALIB_YEAR].copy()
    test_data = df_master[df_master["year"] >= TEST_START_YEAR].copy()

    train_starters = train_data[train_data["is_starter"] == 1].copy()
    train_subs = train_data[train_data["is_starter"] == 0].copy()
    calib_starters = calib_data[calib_data["is_starter"] == 1].copy()
    test_starters = test_data[test_data["is_starter"] == 1].copy()
    test_subs = test_data[test_data["is_starter"] == 0].copy()

    print(f"Train matches: {len(train_data):,} (Starters: {len(train_starters):,}, Subs: {len(train_subs):,})")
    print(f"Calibration matches ({CALIB_YEAR} starters): {len(calib_starters):,}")
    print(f"Test matches ({TEST_START_YEAR}+): {len(test_data):,} (Starters: {len(test_starters):,}, Subs: {len(test_subs):,})")

    # 1. Model A: Starter Expert
    print("\nTraining Model A (Starters XGBRegressor)...")
    model_starters = xgb.XGBRegressor(
        n_estimators=100, learning_rate=0.1, max_depth=5, random_state=SEED
    )
    model_starters.fit(train_starters[all_features], train_starters["rating"])
    preds_starters = model_starters.predict(test_starters[all_features])
    mae_starters = mean_absolute_error(test_starters["rating"], preds_starters)
    print(f"Model A Starters MAE: {mae_starters:.4f}")

    # 2. Model B: Substitute Expert
    print("\nTraining Model B (Substitutes XGBRegressor)...")
    model_subs = xgb.XGBRegressor(
        n_estimators=100, learning_rate=0.1, max_depth=3, random_state=SEED
    )
    model_subs.fit(train_subs[all_features], train_subs["rating"])
    preds_subs = model_subs.predict(test_subs[all_features])
    mae_subs = mean_absolute_error(test_subs["rating"], preds_subs)
    print(f"Model B Subs MAE: {mae_subs:.4f}")

    total_test = len(test_starters) + len(test_subs)
    combined_mae = ((mae_starters * len(test_starters)) + (mae_subs * len(test_subs))) / total_test
    print(f"Combined Two-Model System MAE: {combined_mae:.4f}")

    # 3. Router Classifier (predicts role: starter vs sub)
    print("\nTraining Cascading Role Classifier (XGBClassifier)...")
    train_starters_flag = train_starters.copy()
    train_starters_flag["is_starter"] = 1
    train_subs_flag = train_subs.copy()
    train_subs_flag["is_starter"] = 0
    train_full = pd.concat([train_starters_flag, train_subs_flag], ignore_index=True)

    role_classifier = xgb.XGBClassifier(
        n_estimators=100,
        learning_rate=0.1,
        max_depth=4,
        eval_metric="logloss",
        random_state=SEED,
    )
    role_classifier.fit(train_full[all_features].astype(float), train_full["is_starter"])

    # 4. Conformal Calibration on 2021 validation starters (finite-sample corrected)
    print("\nComputing Conformal Prediction Margin (q_hat)...")
    calib_preds = model_starters.predict(calib_starters[all_features])
    calib_residuals = np.abs(calib_starters["rating"].values - calib_preds)
    q_hat = conformal_margin(calib_residuals, ALPHA)
    print(f"Conformal Margin q_hat ({int((1-ALPHA)*100)}% coverage): ±{q_hat:.4f}")

    # 5. KNN Similarity Engine & Scaler
    print("\nFitting KNN Similarity Engine & Scaler...")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(train_starters[all_features])
    knn = NearestNeighbors(n_neighbors=3, metric="euclidean")
    knn.fit(X_train_scaled)

    # 6. Build Upcoming and Historical Datasets
    print("\nExporting upcoming fixtures and historical matches...")
    upcoming = test_starters.sort_values(by=["player", "datetime"]).copy()
    upcoming_cols = ["player", "datetime"]
    if "opponent" in upcoming.columns:
        upcoming_cols.append("opponent")
    if "is_starter" in upcoming.columns:
        upcoming_cols.append("is_starter")
    upcoming_cols += [f for f in all_features if f in upcoming.columns]
    # Remove duplicates while preserving order
    seen = set()
    dedup_cols = [c for c in upcoming_cols if not (c in seen or seen.add(c))]
    upcoming_export = upcoming[dedup_cols]

    historical_cols = ["player", "datetime", "rating_last_5", "days_since_last_match", "is_home", "rating"]
    historical_export = train_starters[historical_cols].copy()

    # 7. Save Artifacts to ml/models/ and ml/data/
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    bundle_path = MODELS_DIR / "player_ratings.joblib"
    upcoming_path = DATA_DIR / "upcoming_matches.csv"
    historical_path = DATA_DIR / "historical_matches.csv"

    print(f"Exporting upcoming fixtures to {upcoming_path} ...")
    upcoming_export.to_csv(upcoming_path, index=False)

    print(f"Exporting historical matches to {historical_path} ...")
    historical_export.to_csv(historical_path, index=False)

    # Master bundle for backend service
    player_names = sorted(upcoming_export["player"].dropna().unique().tolist())
    bundle = {
        "model_starters": model_starters,
        "model_subs": model_subs,
        "role_classifier": role_classifier,
        "knn": knn,
        "scaler": scaler,
        "features": all_features,
        "position_cols": position_cols,
        "q_hat": round(float(q_hat), 4),
        "player_names": player_names,
        "metrics": {
            "mae_starters": round(float(mae_starters), 4),
            "mae_subs": round(float(mae_subs), 4),
            "combined_mae": round(float(combined_mae), 4),
            "q_hat": round(float(q_hat), 4),
        },
    }

    print(f"Exporting master bundle to {bundle_path} ...")
    joblib.dump(bundle, bundle_path)

    print("\n[SUCCESS] All player rating model artifacts exported successfully!")
    print(f"   Bundle: {bundle_path}")
    print(f"   Upcoming fixtures: {upcoming_path} ({len(upcoming_export):,} rows)")
    print(f"   Historical matches: {historical_path} ({len(historical_export):,} rows)")


if __name__ == "__main__":
    main()
