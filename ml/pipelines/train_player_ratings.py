"""
train_player_ratings.py
Trains the player performance rating models (from MiniProjetML.ipynb) and exports
all artifacts to ml/models/ and ml/data/ for the Forzalytics platform.

Pipeline architecture:
- Chronological Split: Train (<= 2020), Conformal Calibration (2021), Test (>= 2022)
- Feature Engineering: Rolling ratings (L3, L5, L10), Rest days, Volatility (std 5),
  Momentum (L3 - L10), Home/Away binary, and One-Hot encoded positions.
- Cascading Router:
  * Role Classifier (XGBClassifier) predicts starter vs substitute
  * Model A: Starter Expert (XGBRegressor max_depth=5)
  * Model B: Substitute Expert (XGBRegressor max_depth=3)
- Conformal Prediction: Calibrated 90% prediction interval (q_hat margin)
- Similarity Engine: StandardScaler + NearestNeighbors (KNN, k=3) for context comparison
- Artifacts: Saves player_ratings.joblib, upcoming_matches.csv, historical_matches.csv

Run:
    python ml/pipelines/train_player_ratings.py
"""
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error
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


def resolve_ratings_path() -> Path:
    for p in DATASET_CANDIDATES:
        if p.exists():
            return p
    raise FileNotFoundError(
        f"ratings.csv not found in any expected location: {[str(p) for p in DATASET_CANDIDATES]}"
    )


def extract_features(df_clean: pd.DataFrame):
    """
    Computes time-aware non-leaking features per player exactly as in MiniProjetML.ipynb.
    """
    print("Computing player rolling metrics and momentum...")
    df_clean = df_clean.sort_values(by=["player", "datetime"]).reset_index(drop=True)

    # Rolling averages with shift(1) to strictly prevent data leakage
    df_clean["rating_last_3"] = df_clean.groupby("player")["rating"].transform(
        lambda x: x.shift(1).rolling(window=3, min_periods=1).mean()
    )
    df_clean["rating_last_5"] = df_clean.groupby("player")["rating"].transform(
        lambda x: x.shift(1).rolling(window=5, min_periods=1).mean()
    )
    df_clean["rating_last_10"] = df_clean.groupby("player")["rating"].transform(
        lambda x: x.shift(1).rolling(window=10, min_periods=5).mean()
    )

    # Workload proxy: days since player's last match
    df_clean["days_since_last_match"] = df_clean.groupby("player")["datetime"].diff().dt.days

    # Form volatility: rolling standard deviation of last 5 matches
    df_clean["rating_std_5"] = df_clean.groupby("player")["rating"].transform(
        lambda x: x.shift(1).rolling(window=5, min_periods=3).std()
    )

    # Momentum: short term form vs baseline
    df_clean["momentum"] = df_clean["rating_last_3"] - df_clean["rating_last_10"]

    # Filter out initial matches with insufficient rolling history
    df_features = df_clean.dropna(
        subset=["rating_last_10", "days_since_last_match", "rating_std_5"]
    ).copy()

    df_features["year"] = df_features["datetime"].dt.year
    df_features["is_home"] = (
        df_features["home_or_away"].astype(str).str.lower().str.contains("home")
    ).astype(int)

    # One-hot encode position
    df_features = pd.get_dummies(df_features, columns=["position"], drop_first=False, dtype=int)

    # Starter vs Substitute indicator
    if "position_Sub" in df_features.columns:
        df_features["is_starter"] = (df_features["position_Sub"] == 0).astype(int)
        df_master = df_features.drop(columns=["position_Sub"]).copy()
    else:
        df_features["is_starter"] = 1
        df_master = df_features.copy()

    position_cols = [c for c in df_master.columns if c.startswith("position_")]
    all_features = [
        "rating_last_3",
        "rating_last_5",
        "rating_last_10",
        "days_since_last_match",
        "rating_std_5",
        "momentum",
        "is_home",
    ] + position_cols

    return df_master, all_features, position_cols


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
    train_data = df_master[df_master["year"] <= 2020].copy()
    val_data = df_master[df_master["year"] == 2021].copy()
    test_data = df_master[df_master["year"] >= 2022].copy()

    train_starters = train_data[train_data["is_starter"] == 1].copy()
    train_subs = train_data[train_data["is_starter"] == 0].copy()
    val_starters = val_data[val_data["is_starter"] == 1].copy()
    test_starters = test_data[test_data["is_starter"] == 1].copy()
    test_subs = test_data[test_data["is_starter"] == 0].copy()

    print(f"Train matches: {len(train_data):,} (Starters: {len(train_starters):,}, Subs: {len(train_subs):,})")
    print(f"Validation matches (2021): {len(val_data):,}")
    print(f"Test matches (2022+): {len(test_data):,}")

    # 1. Model A: Starter Expert
    print("\nTraining Model A (Starters XGBRegressor)...")
    model_starters = xgb.XGBRegressor(
        n_estimators=100, learning_rate=0.1, max_depth=5, random_state=42
    )
    model_starters.fit(train_starters[all_features], train_starters["rating"])
    preds_starters = model_starters.predict(test_starters[all_features])
    mae_starters = mean_absolute_error(test_starters["rating"], preds_starters)
    print(f"Model A Starters MAE: {mae_starters:.4f}")

    # 2. Model B: Substitute Expert
    print("\nTraining Model B (Substitutes XGBRegressor)...")
    model_subs = xgb.XGBRegressor(
        n_estimators=100, learning_rate=0.1, max_depth=3, random_state=42
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
        random_state=42,
    )
    role_classifier.fit(train_full[all_features].astype(float), train_full["is_starter"])

    # 4. Conformal Calibration on 2021 validation set (90% target coverage)
    print("\nComputing Conformal Prediction Margin (q_hat)...")
    calib_preds = model_starters.predict(val_starters[all_features])
    calib_residuals = np.abs(val_starters["rating"] - calib_preds)
    q_hat = float(np.quantile(calib_residuals, 0.90))
    print(f"Conformal Margin q_hat (90% coverage): ±{q_hat:.4f}")

    # 5. KNN Similarity Engine
    print("\nFitting KNN Similarity Engine & Scaler...")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(train_starters[all_features])
    knn = NearestNeighbors(n_neighbors=3, metric="euclidean")
    knn.fit(X_train_scaled)

    # 6. Build Upcoming and Historical Datasets
    print("\nExtracting upcoming match fixtures with opponents...")
    if "season" in test_data.columns and "2022/2023" in test_data["season"].values:
        upcoming = test_data[test_data["season"] == "2022/2023"].sort_values(by=["player", "datetime"]).copy()
    else:
        upcoming = test_data.sort_values(by=["player", "datetime"]).copy()

    # Extract opponent names from raw dataset
    if "home_team" in upcoming.columns and "away_team" in upcoming.columns:
        h_col = "home_team"
        a_col = "away_team"
    else:
        raw_df_stripped = raw_df.copy()
        raw_df_stripped.columns = raw_df_stripped.columns.str.strip()
        h_col = [c for c in raw_df_stripped.columns if "home" in c.lower() and "team" in c.lower()][0]
        a_col = [c for c in raw_df_stripped.columns if "away" in c.lower() and "team" in c.lower()][0]
        raw_teams = raw_df_stripped[["player", "datetime", h_col, a_col]].drop_duplicates()
        raw_teams["datetime"] = pd.to_datetime(raw_teams["datetime"])
        raw_teams = raw_teams.rename(columns={h_col: "home_team_raw", a_col: "away_team_raw"})
        upcoming = pd.merge(upcoming, raw_teams, on=["player", "datetime"], how="left")
        h_col = "home_team_raw"
        a_col = "away_team_raw"

    upcoming["opponent"] = np.where(
        upcoming["is_home"] == 1,
        upcoming[a_col].fillna("Adversaire"),
        upcoming[h_col].fillna("Adversaire"),
    )
    upcoming = upcoming.drop(columns=[c for c in upcoming.columns if "team" in c.lower()], errors="ignore")

    historical = train_starters[
        ["player", "datetime", "rating_last_5", "days_since_last_match", "is_home", "rating"]
    ].copy()

    # 7. Save Artifacts to ml/models/ and ml/data/
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    bundle_path = MODELS_DIR / "player_ratings.joblib"
    upcoming_path = DATA_DIR / "upcoming_matches.csv"
    historical_path = DATA_DIR / "historical_matches.csv"

    print(f"\nExporting upcoming fixtures to {upcoming_path} ...")
    upcoming.to_csv(upcoming_path, index=False)

    print(f"Exporting historical matches to {historical_path} ...")
    historical.to_csv(historical_path, index=False)

    # Master bundle
    player_names = sorted(upcoming["player"].dropna().unique().tolist())
    bundle = {
        "model_starters": model_starters,
        "model_subs": model_subs,
        "role_classifier": role_classifier,
        "knn": knn,
        "scaler": scaler,
        "features": all_features,
        "position_cols": position_cols,
        "q_hat": q_hat,
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
    print(f"   Upcoming fixtures: {upcoming_path} ({len(upcoming):,} rows)")
    print(f"   Historical matches: {historical_path} ({len(historical):,} rows)")


if __name__ == "__main__":
    main()
