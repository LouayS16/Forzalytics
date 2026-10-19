"""
train_total_goals_regression.py
Independent ML pipeline for Expected Total Goals (xG Total) using Linear Regression.
Target: total_goals = home_score + away_score
Anti-leakage: Pre-kickoff rolling statistics computed with shift(1).
"""
import os
import sys
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, median_absolute_error
from sklearn.model_selection import train_test_split

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ML_DIR = BASE_DIR / "ml"
DATA_PATH = ML_DIR / "data" / "cleaned_dataset.csv"
MODEL_SAVE_PATH = ML_DIR / "models" / "model_total_goals_regression.joblib"


def load_dataset() -> pd.DataFrame:
    """Load cleaned match dataset in read-only mode."""
    candidates = [
        DATA_PATH,
        BASE_DIR / "cleaned_dataset.csv",
        Path("ml/data/cleaned_dataset.csv"),
    ]
    for p in candidates:
        if p.exists():
            print(f"Loading dataset from: {p}")
            df = pd.read_csv(p, low_memory=False)
            df["datetime"] = pd.to_datetime(df["datetime"])
            return df
    raise FileNotFoundError(f"Could not locate cleaned_dataset.csv in {[str(c) for c in candidates]}")


def build_total_goals_features(df: pd.DataFrame, window_size: int = 5) -> pd.DataFrame:
    """
    Compute pre-kickoff 5-match rolling offensive and defensive features with strict shift(1).
    Target: total_goals = home_score + away_score
    """
    print(f"Building pre-kickoff rolling features (window={window_size}) with shift(1) anti-leakage...")

    # Calculate Total Goals target
    df["total_goals"] = df["home_score"].astype(float) + df["away_score"].astype(float)

    # Build Team-Game records
    home_records = pd.DataFrame({
        "match_id": df["match_id"],
        "datetime": df["datetime"],
        "team": df["home_team"],
        "goals_for": df["home_score"].astype(float),
        "goals_against": df["away_score"].astype(float),
        "shots_for": df["home_shots"].astype(float),
        "sot_for": df["home_shots_on_target"].astype(float),
        "corners": df["home_corners"].astype(float),
        "fouls": df["home_fouls"].astype(float),
        "possession": df["home_possession"].astype(float),
    })

    away_records = pd.DataFrame({
        "match_id": df["match_id"],
        "datetime": df["datetime"],
        "team": df["away_team"],
        "goals_for": df["away_score"].astype(float),
        "goals_against": df["home_score"].astype(float),
        "shots_for": df["away_shots"].astype(float),
        "sot_for": df["away_shots_on_target"].astype(float),
        "corners": df["away_corners"].astype(float),
        "fouls": df["away_fouls"].astype(float),
        "possession": df["away_possession"].astype(float),
    })

    team_games = pd.concat([home_records, away_records], ignore_index=True)
    team_games.sort_values(by=["team", "datetime", "match_id"], inplace=True)
    team_games.reset_index(drop=True, inplace=True)

    grouped = team_games.groupby("team", group_keys=False)
    rolled = pd.DataFrame({"match_id": team_games["match_id"], "team": team_games["team"]})

    # Rolling window stats with strict shift(1) protection
    rolled["avg_gf_l5"] = grouped["goals_for"].apply(lambda s: s.shift(1).rolling(window_size, min_periods=1).mean())
    rolled["avg_ga_l5"] = grouped["goals_against"].apply(lambda s: s.shift(1).rolling(window_size, min_periods=1).mean())
    rolled["avg_shots_l5"] = grouped["shots_for"].apply(lambda s: s.shift(1).rolling(window_size, min_periods=1).mean())
    rolled["avg_sot_l5"] = grouped["sot_for"].apply(lambda s: s.shift(1).rolling(window_size, min_periods=1).mean())
    rolled["avg_corners_l5"] = grouped["corners"].apply(lambda s: s.shift(1).rolling(window_size, min_periods=1).mean())
    rolled["avg_fouls_l5"] = grouped["fouls"].apply(lambda s: s.shift(1).rolling(window_size, min_periods=1).mean())
    rolled["n_matches_l5"] = grouped["goals_for"].apply(lambda s: s.shift(1).rolling(window_size, min_periods=1).count())

    home_feat = rolled.copy().add_prefix("home_").rename(columns={"home_match_id": "match_id", "home_team": "home_team"})
    away_feat = rolled.copy().add_prefix("away_").rename(columns={"away_match_id": "match_id", "away_team": "away_team"})

    m = pd.merge(df, home_feat, on=["match_id", "home_team"], how="left")
    m = pd.merge(m, away_feat, on=["match_id", "away_team"], how="left")

    # Composite Features for Total Goals
    m["sum_avg_gf_l5"] = m["home_avg_gf_l5"] + m["away_avg_gf_l5"]
    m["sum_avg_ga_l5"] = m["home_avg_ga_l5"] + m["away_avg_ga_l5"]
    m["sum_avg_sot_l5"] = m["home_avg_sot_l5"] + m["away_avg_sot_l5"]
    m["sum_avg_shots_l5"] = m["home_avg_shots_l5"] + m["away_avg_shots_l5"]
    m["sum_avg_corners_l5"] = m["home_avg_corners_l5"] + m["away_avg_corners_l5"]

    # Match Total Expectancy Estimate (Pairing home attack vs away defense + away attack vs home defense)
    m["expected_pairing_goals"] = ((m["home_avg_gf_l5"] + m["away_avg_ga_l5"]) / 2.0) + \
                                  ((m["away_avg_gf_l5"] + m["home_avg_ga_l5"]) / 2.0)

    # Filter out initial matches where teams have no prior history
    valid_df = m[(m["home_n_matches_l5"] >= 2) & (m["away_n_matches_l5"] >= 2)].copy()
    valid_df.dropna(subset=["total_goals", "expected_pairing_goals"], inplace=True)
    return valid_df


def train_linear_regression(df: pd.DataFrame):
    """Train and evaluate the Linear Regression model for Total Goals."""
    feature_cols = [
        "home_avg_gf_l5",
        "home_avg_ga_l5",
        "away_avg_gf_l5",
        "away_avg_ga_l5",
        "sum_avg_gf_l5",
        "sum_avg_ga_l5",
        "sum_avg_sot_l5",
        "sum_avg_shots_l5",
        "sum_avg_corners_l5",
        "expected_pairing_goals",
    ]

    print(f"\nTraining Linear Regression on {len(df):,} matches with {len(feature_cols)} features...")
    print(f"Target distribution: Mean={df['total_goals'].mean():.2f}, Std={df['total_goals'].std():.2f}, Median={df['total_goals'].median():.1f}")

    X = df[feature_cols].fillna(0)
    y = df["total_goals"]

    # Train/Test Split (80% Train, 20% Test)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, shuffle=True
    )

    model = LinearRegression()
    model.fit(X_train, y_train)

    # Predictions
    y_pred_train = model.predict(X_train)
    y_pred_test = model.predict(X_test)

    # Metrics
    mae_train = mean_absolute_error(y_train, y_pred_train)
    mae_test = mean_absolute_error(y_test, y_pred_test)
    rmse_test = np.sqrt(mean_squared_error(y_test, y_pred_test))
    medae_test = median_absolute_error(y_test, y_pred_test)
    r2_test = r2_score(y_test, y_pred_test)

    print("\n" + "=" * 50)
    print("      LINEAR REGRESSION EVALUATION RESULTS      ")
    print("=" * 50)
    print(f" Train Samples : {len(X_train):,}")
    print(f" Test Samples  : {len(X_test):,}")
    print(f" Train MAE     : {mae_train:.4f} goals")
    print(f" Test MAE      : {mae_test:.4f} goals")
    print(f" Test RMSE     : {rmse_test:.4f} goals")
    print(f" Test MedAE    : {medae_test:.4f} goals")
    print(f" Test R²       : {r2_test:.4f}")
    print("=" * 50)

    # Display Model Coefficients
    print("\nModel Coefficients (Impact on Expected Total Goals):")
    for feat, coef in zip(feature_cols, model.coef_):
        print(f"  {feat:<25} : {coef:+.4f}")
    print(f"  {'Intercept':<25} : {model.intercept_:+.4f}")

    # Accuracy on Over / Under 2.5 Goals (Classification proxy)
    actual_over25 = (y_test > 2.5).astype(int)
    pred_over25 = (y_pred_test > 2.5).astype(int)
    over_under_acc = np.mean(actual_over25 == pred_over25)
    print(f"\nOver / Under 2.5 Goals Threshold Accuracy: {over_under_acc * 100:.2f}%")

    # Generate and save regression curve plot
    curve_meta = plot_regression_curve(df, X_test, y_test, y_pred_test, model)

    # Save artifact
    MODEL_SAVE_PATH.parent.mkdir(parents=True, exist_ok=True)
    artifact = {
        "model": model,
        "feature_cols": feature_cols,
        "metrics": {
            "mae": float(mae_test),
            "rmse": float(rmse_test),
            "r2": float(r2_test),
            "over_under_2_5_acc": float(over_under_acc),
        },
        "regression_curve": curve_meta,
        "target_mean": float(y.mean()),
        "target_std": float(y.std()),
        "model_type": "LinearRegression",
    }
    joblib.dump(artifact, MODEL_SAVE_PATH)
    print(f"\nTrained Linear Regression model successfully saved to:\n  {MODEL_SAVE_PATH}\n")


def plot_regression_curve(df, X_test, y_test, y_pred_test, model):
    """Generate high-resolution visual regression curve plots."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    print("\nGenerating Regression Curves (Courbes de Régression)...")
    plt.style.use("dark_background")
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6), dpi=120)

    # Subplot 1: Regression Trendline (Expected Pairing Goals vs Total Goals)
    sample_sub = df.sample(min(2000, len(df)), random_state=42)
    x_feat = sample_sub["expected_pairing_goals"]
    y_actual = sample_sub["total_goals"]

    ax1.scatter(x_feat, y_actual, alpha=0.18, color="#38bdf8", s=25, label="Matches Archive")

    # Fit 1D trendline for visualization
    m_slope, b_intercept = np.polyfit(df["expected_pairing_goals"], df["total_goals"], 1)
    x_vals = np.linspace(x_feat.min(), x_feat.max(), 100)
    y_vals = m_slope * x_vals + b_intercept

    ax1.plot(x_vals, y_vals, color="#f43f5e", linewidth=3.5, label=f"Regression Line: y = {m_slope:.2f}x + {b_intercept:.2f}")
    ax1.axhline(2.5, color="#fbbf24", linestyle="--", linewidth=1.5, alpha=0.8, label="Over/Under 2.5 Line")
    ax1.set_title("Courbe de Régression : Buts Attendus vs Total Réel", fontsize=13, fontweight="bold", pad=12, color="#f8fafc")
    ax1.set_xlabel("Expected Pairing Index (Offensive Potential)", fontsize=11, color="#cbd5e1")
    ax1.set_ylabel("Total Buts Réels (Home + Away)", fontsize=11, color="#cbd5e1")
    ax1.grid(True, linestyle=":", alpha=0.3)
    ax1.legend(loc="upper left", framealpha=0.4)

    # Subplot 2: Predicted Goals vs Actual Goals (Mean binned curve)
    test_analysis = pd.DataFrame({"Actual": y_test, "Predicted": y_pred_test})
    test_analysis["Pred_Bin"] = pd.qcut(test_analysis["Predicted"], q=10, duplicates="drop")
    binned = test_analysis.groupby("Pred_Bin", observed=False).agg({"Predicted": "mean", "Actual": "mean"})

    ax2.plot(binned["Predicted"], binned["Actual"], marker="o", markersize=8, color="#34d399", linewidth=2.8, label="Predicted vs Actual Curve")
    ideal_line = np.linspace(binned["Predicted"].min(), binned["Predicted"].max(), 50)
    ax2.plot(ideal_line, ideal_line, color="#94a3b8", linestyle="--", linewidth=1.5, label="Ligne Idéale (1:1)")
    ax2.axvline(2.5, color="#fbbf24", linestyle=":", linewidth=1.5, alpha=0.7)
    ax2.set_title("Courbe de Calibration des Prédictions", fontsize=13, fontweight="bold", pad=12, color="#f8fafc")
    ax2.set_xlabel("Predicted Total Goals (Linear Regression)", fontsize=11, color="#cbd5e1")
    ax2.set_ylabel("Actual Average Goals Observed", fontsize=11, color="#cbd5e1")
    ax2.grid(True, linestyle=":", alpha=0.3)
    ax2.legend(loc="upper left", framealpha=0.4)

    plt.tight_layout()

    # Save to ml/models and frontend/public
    output_path1 = ML_DIR / "models" / "regression_curve.png"
    output_path2 = BASE_DIR / "frontend" / "public" / "regression_curve.png"
    plt.savefig(output_path1, bbox_inches="tight")
    plt.savefig(output_path2, bbox_inches="tight")
    plt.close()

    print(f"Regression curve saved to:\n  - {output_path1}\n  - {output_path2}")
    return {
        "slope": float(m_slope),
        "intercept": float(b_intercept),
        "min_x": float(x_feat.min()),
        "max_x": float(x_feat.max()),
    }


if __name__ == "__main__":
    raw_df = load_dataset()
    features_df = build_total_goals_features(raw_df)
    train_linear_regression(features_df)
