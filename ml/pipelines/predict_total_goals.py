"""
predict_total_goals.py
Independent CLI prediction tool for Expected Total Goals (xG Total) using the trained Linear Regression model.
No existing files modified.
"""
import argparse
import math
from pathlib import Path
import joblib
import numpy as np
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ML_DIR = BASE_DIR / "ml"
MODEL_PATH = ML_DIR / "models" / "model_total_goals_regression.joblib"
DATASET_PATH = ML_DIR / "data" / "cleaned_dataset.csv"


def load_model_artifact():
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model artifact not found at {MODEL_PATH}. Run train_total_goals_regression.py first.")
    return joblib.load(MODEL_PATH)


def load_dataset():
    if not DATASET_PATH.exists():
        raise FileNotFoundError(f"Dataset not found at {DATASET_PATH}.")
    df = pd.read_csv(DATASET_PATH, low_memory=False)
    df["datetime"] = pd.to_datetime(df["datetime"])
    return df


try:
    from backend.total_goals_server import find_team_match_history as calculate_team_rolling_stats
except ImportError:
    import sys
    sys.path.insert(0, str(BASE_DIR))
    from backend.total_goals_server import find_team_match_history as calculate_team_rolling_stats


def compute_over_under_probabilities(expected_goals: float):
    """Compute Poisson distribution probabilities for standard over/under lines."""
    lam = max(0.1, expected_goals)
    
    # Poisson PMF for k goals
    pmf = [math.exp(-lam) * (lam ** k) / math.factorial(k) for k in range(12)]
    
    # Over lines
    prob_over_1_5 = 1.0 - sum(pmf[:2])
    prob_over_2_5 = 1.0 - sum(pmf[:3])
    prob_over_3_5 = 1.0 - sum(pmf[:4])
    
    return {
        "over_1_5": round(prob_over_1_5 * 100, 1),
        "under_1_5": round((1.0 - prob_over_1_5) * 100, 1),
        "over_2_5": round(prob_over_2_5 * 100, 1),
        "under_2_5": round((1.0 - prob_over_2_5) * 100, 1),
        "over_3_5": round(prob_over_3_5 * 100, 1),
        "under_3_5": round((1.0 - prob_over_3_5) * 100, 1),
    }


def predict_match(home_team: str, away_team: str):
    artifact = load_model_artifact()
    model = artifact["model"]
    feature_cols = artifact["feature_cols"]
    df = load_dataset()

    home_stats = calculate_team_rolling_stats(home_team, df)
    away_stats = calculate_team_rolling_stats(away_team, df)

    if not home_stats or not away_stats:
        print(f"Error: Could not find sufficient match history for '{home_team}' or '{away_team}'.")
        print("Please check team names against database.")
        return

    # Build Feature Vector
    features = {
        "home_avg_gf_l5": home_stats["avg_gf"],
        "home_avg_ga_l5": home_stats["avg_ga"],
        "away_avg_gf_l5": away_stats["avg_gf"],
        "away_avg_ga_l5": away_stats["avg_ga"],
        "sum_avg_gf_l5": home_stats["avg_gf"] + away_stats["avg_gf"],
        "sum_avg_ga_l5": home_stats["avg_ga"] + away_stats["avg_ga"],
        "sum_avg_sot_l5": home_stats["avg_sot"] + away_stats["avg_sot"],
        "sum_avg_shots_l5": home_stats["avg_shots"] + away_stats["avg_shots"],
        "sum_avg_corners_l5": home_stats["avg_corners"] + away_stats["avg_corners"],
        "expected_pairing_goals": ((home_stats["avg_gf"] + away_stats["avg_ga"]) / 2.0) + \
                                  ((away_stats["avg_gf"] + home_stats["avg_ga"]) / 2.0),
    }

    X = pd.DataFrame([features])[feature_cols]
    expected_goals = float(model.predict(X)[0])
    # Total goals cannot be negative
    expected_goals = max(0.2, expected_goals)

    probs = compute_over_under_probabilities(expected_goals)

    print("\n" + "=" * 60)
    print(f"   EXPECTED TOTAL GOALS PREDICTION (LINEAR REGRESSION)")
    print("=" * 60)
    print(f" Match Fixture       : {home_team} (Home) vs {away_team} (Away)")
    print(f" Model Used          : Scikit-Learn Linear Regression")
    print(f" Expected Goals (xG) : {expected_goals:.2f} Total Goals")
    print("-" * 60)
    print(" Recent 5-Match Form Breakdown:")
    print(f"  {home_team:<18} : Avg Goals Scored={home_stats['avg_gf']:.2f} | Conceded={home_stats['avg_ga']:.2f}")
    print(f"  {away_team:<18} : Avg Goals Scored={away_stats['avg_gf']:.2f} | Conceded={away_stats['avg_ga']:.2f}")
    print("-" * 60)
    print(" Over / Under Probability Forecast:")
    print(f"  Over 1.5 Goals     : {probs['over_1_5']}%  | Under 1.5 : {probs['under_1_5']}%")
    print(f"  Over 2.5 Goals     : {probs['over_2_5']}%  | Under 2.5 : {probs['under_2_5']}%")
    print(f"  Over 3.5 Goals     : {probs['over_3_5']}%  | Under 3.5 : {probs['under_3_5']}%")
    print("=" * 60)
    print(f" Recommendation     : {'OVER 2.5 GOALS' if expected_goals >= 2.5 else 'UNDER 2.5 GOALS'}\n")

    return {
        "home_team": home_team,
        "away_team": away_team,
        "expected_total_goals": round(expected_goals, 2),
        "probabilities": probs,
        "home_stats": home_stats,
        "away_stats": away_stats,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Predict Total Match Goals via Linear Regression")
    parser.add_argument("--home", type=str, default="Liverpool", help="Home team name (e.g., 'Liverpool', 'Real Madrid')")
    parser.add_argument("--away", type=str, default="Manchester City", help="Away team name (e.g., 'Manchester City', 'Barcelona')")
    args = parser.parse_args()

    predict_match(args.home, args.away)
