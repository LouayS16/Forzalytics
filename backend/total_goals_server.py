"""
total_goals_server.py
All-in-one standalone microservice for Expected Total Goals predictions using Linear Regression.
Contains both mathematical inference logic and Flask REST API endpoints on port 5001.
"""
import os
import sys
import math
import re
from pathlib import Path
from typing import Dict, Any, Optional
import joblib
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS

# Project Paths
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

ML_DIR = BASE_DIR / "ml"
MODEL_PATH = ML_DIR / "models" / "model_total_goals_regression.joblib"
DATASET_PATH = ML_DIR / "data" / "cleaned_dataset.csv"

# Global In-Memory Caches
_CACHED_MODEL_ARTIFACT = None
_CACHED_DATASET = None

# Comprehensive European team normalization mapping
EUROPEAN_TEAM_ALIASES = {
    # Germany (Bundesliga)
    "bayern munich": "Bayern Monachium",
    "bayern munchen": "Bayern Monachium",
    "bayern münchen": "Bayern Monachium",
    "bayern": "Bayern Monachium",
    "dortmund": "Borussia Dortmund",
    "borussia dortmund": "Borussia Dortmund",
    "bvb": "Borussia Dortmund",
    "bayer leverkusen": "Bayer Leverkusen",
    "leverkusen": "Bayer Leverkusen",
    "rb leipzig": "RB Lipsk",
    "leipzig": "RB Lipsk",
    "eintracht frankfurt": "Eintracht Frankfurt",
    "frankfurt": "Eintracht Frankfurt",
    "wolfsburg": "VfL Wolfsburg",
    "stuttgart": "VfB Stuttgart",

    # Spain (La Liga)
    "real madrid": "Real Madryt",
    "real madrid cf": "Real Madryt",
    "atletico madrid": "Atl. Madryt",
    "atletico de madrid": "Atl. Madryt",
    "barcelona": "Barcelona",
    "fc barcelona": "Barcelona",
    "sevilla": "Sevilla",
    "real betis": "Betis",
    "betis": "Betis",
    "valencia": "Valencia",
    "villarreal": "Villarreal",
    "athletic bilbao": "Ath. Bilbao",
    "athletic club": "Ath. Bilbao",
    "real sociedad": "Real Sociedad",

    # Italy (Serie A)
    "inter": "Inter",
    "inter milan": "Inter",
    "internazionale": "Inter",
    "milan": "AC Milan",
    "ac milan": "AC Milan",
    "juventus": "Juventus",
    "juve": "Juventus",
    "roma": "AS Roma",
    "as roma": "AS Roma",
    "lazio": "Lazio",
    "napoli": "Napoli",
    "atalanta": "Atalanta",
    "fiorentina": "Fiorentina",

    # France (Ligue 1)
    "psg": "Paris SG",
    "paris saint germain": "Paris SG",
    "paris saint-germain": "Paris SG",
    "paris sg": "Paris SG",
    "marseille": "Marsylia",
    "olympique marseille": "Marsylia",
    "marsylia": "Marsylia",
    "lyon": "Lyon",
    "monaco": "Monaco",
    "lille": "Lille",
    "nice": "Nice",

    # England (Premier League)
    "arsenal": "Arsenal",
    "arsenal fc": "Arsenal",
    "chelsea": "Chelsea",
    "chelsea fc": "Chelsea",
    "liverpool": "Liverpool",
    "liverpool fc": "Liverpool",
    "manchester city": "Manchester City",
    "man city": "Manchester City",
    "manchester united": "Manchester Utd",
    "man united": "Manchester Utd",
    "man utd": "Manchester Utd",
    "tottenham": "Tottenham",
    "spurs": "Tottenham",
    "newcastle": "Newcastle",
    "aston villa": "Aston Villa",
}

# Import colleague's aliases if available
try:
    from backend.app.services.football_provider import TEAM_ALIASES as FRIEND_ALIASES
    for k, v in FRIEND_ALIASES.items():
        if k.lower() not in EUROPEAN_TEAM_ALIASES:
            EUROPEAN_TEAM_ALIASES[k.lower()] = v
except Exception:
    pass


def normalize_team(name: str) -> str:
    cleaned = str(name).strip().lower()
    if cleaned in EUROPEAN_TEAM_ALIASES:
        return EUROPEAN_TEAM_ALIASES[cleaned]
    for alias_key, target_name in EUROPEAN_TEAM_ALIASES.items():
        if alias_key == cleaned or (len(alias_key) >= 4 and alias_key in cleaned):
            return target_name
    return str(name).strip()


def get_model_artifact():
    global _CACHED_MODEL_ARTIFACT
    if _CACHED_MODEL_ARTIFACT is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Model artifact not found at {MODEL_PATH}")
        _CACHED_MODEL_ARTIFACT = joblib.load(MODEL_PATH)
    return _CACHED_MODEL_ARTIFACT


def get_match_dataset():
    global _CACHED_DATASET
    if _CACHED_DATASET is None:
        if not DATASET_PATH.exists():
            raise FileNotFoundError(f"Dataset not found at {DATASET_PATH}")
        df = pd.read_csv(DATASET_PATH, low_memory=False)
        df["datetime"] = pd.to_datetime(df["datetime"])
        _CACHED_DATASET = df
    return _CACHED_DATASET


def find_team_match_history(team_name: str, df: pd.DataFrame, n_matches: int = 5):
    """Find last N matches for team with multi-level fuzzy matching."""
    norm_name = normalize_team(team_name)
    clean_name = norm_name.lower()

    # 1. Exact match
    matched_df = df[(df["home_team"].str.lower() == clean_name) | (df["away_team"].str.lower() == clean_name)]

    # 2. Substring match
    if len(matched_df) == 0:
        raw_clean = team_name.strip().lower()
        mask_h = df["home_team"].str.lower().str.contains(raw_clean, regex=False, na=False)
        mask_a = df["away_team"].str.lower().str.contains(raw_clean, regex=False, na=False)
        matched_df = df[mask_h | mask_a]

    # 3. Token-based fallback
    if len(matched_df) == 0:
        tokens = [t for t in re.findall(r'\b[a-zA-Z]{4,}\b', team_name.lower()) if t not in {'club', 'team', 'town', 'city'}]
        for token in tokens:
            mask_h = df["home_team"].str.lower().str.contains(token, regex=False, na=False)
            mask_a = df["away_team"].str.lower().str.contains(token, regex=False, na=False)
            token_matches = df[mask_h | mask_a]
            if len(token_matches) > 0:
                matched_df = token_matches
                break

    if len(matched_df) == 0:
        return None

    resolved_name = team_name

    records = []
    for _, row in matched_df.iterrows():
        is_home = (clean_name in str(row["home_team"]).lower())
        records.append({
            "datetime": row["datetime"],
            "match_id": row["match_id"],
            "opponent": row["away_team"] if is_home else row["home_team"],
            "venue": "Home" if is_home else "Away",
            "goals_for": float(row["home_score"] if is_home else row["away_score"]),
            "goals_against": float(row["away_score"] if is_home else row["home_score"]),
            "shots": float(row["home_shots"] if is_home else row["away_shots"]),
            "sot": float(row["home_shots_on_target"] if is_home else row["away_shots_on_target"]),
            "corners": float(row["home_corners"] if is_home else row["away_corners"]),
            "fouls": float(row["home_fouls"] if is_home else row["away_fouls"]),
            "possession": float(row["home_possession"] if is_home else row["away_possession"]),
            "score_str": f"{row['home_team']} {row['home_score']}-{row['away_score']} {row['away_team']}",
        })

    rec_df = pd.DataFrame(records).sort_values("datetime", ascending=False).head(n_matches)

    return {
        "team_name": resolved_name,
        "sample_size": len(rec_df),
        "avg_gf": float(rec_df["goals_for"].mean()),
        "avg_ga": float(rec_df["goals_against"].mean()),
        "avg_shots": float(rec_df["shots"].mean()),
        "avg_sot": float(rec_df["sot"].mean()),
        "avg_corners": float(rec_df["corners"].mean()),
        "avg_fouls": float(rec_df["fouls"].mean()),
        "avg_poss": float(rec_df["possession"].mean()),
        "recent_matches": rec_df[["score_str", "venue", "goals_for", "goals_against"]].to_dict(orient="records"),
    }


def compute_poisson_probs(expected_goals: float) -> Dict[str, float]:
    lam = max(0.1, expected_goals)
    pmf = [math.exp(-lam) * (lam ** k) / math.factorial(k) for k in range(12)]
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


def predict_total_goals(home_team: str, away_team: str) -> Dict[str, Any]:
    artifact = get_model_artifact()
    model = artifact["model"]
    feature_cols = artifact["feature_cols"]
    df = get_match_dataset()

    home_stats = find_team_match_history(home_team, df)
    away_stats = find_team_match_history(away_team, df)

    if not home_stats or not away_stats:
        target_mean = artifact.get("target_mean", 2.61)
        return {
            "success": False,
            "error": f"Insufficient historical records for '{home_team}' or '{away_team}' in 96,305 matches archive.",
            "fallback_expected_goals": round(target_mean, 2),
        }

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
    expected_goals = max(0.2, expected_goals)

    probs = compute_poisson_probs(expected_goals)

    return {
        "success": True,
        "home_team": home_team,
        "away_team": away_team,
        "model_type": "LinearRegression",
        "expected_total_goals": round(expected_goals, 2),
        "recommendation": "OVER 2.5 GOALS" if expected_goals >= 2.5 else "UNDER 2.5 GOALS",
        "confidence": "HIGH" if abs(expected_goals - 2.5) >= 0.4 else "MODERATE",
        "probabilities": probs,
        "team_metrics": {
            "home": {
                "name": home_team,
                "avg_scored": round(home_stats["avg_gf"], 2),
                "avg_conceded": round(home_stats["avg_ga"], 2),
                "avg_shots": round(home_stats["avg_shots"], 1),
                "recent_form": home_stats["recent_matches"]
            },
            "away": {
                "name": away_team,
                "avg_scored": round(away_stats["avg_gf"], 2),
                "avg_conceded": round(away_stats["avg_ga"], 2),
                "avg_shots": round(away_stats["avg_shots"], 1),
                "recent_form": away_stats["recent_matches"]
            }
        },
        "model_metrics": artifact.get("metrics", {}),
        "regression_curve": {
            **artifact.get("regression_curve", {}),
            "current_x": round(float(features["expected_pairing_goals"]), 2),
            "current_y": round(expected_goals, 2),
            "curve_image_url": "/regression_curve.png"
        }
    }


# ==========================================
# FLASK REST API SERVER
# ==========================================
app = Flask(__name__)
CORS(app)

PORT = int(os.getenv("TOTAL_GOALS_PORT", 5001))
HOST = os.getenv("HOST", "127.0.0.1")


@app.route("/api/total-goals/health", methods=["GET"])
def health():
    try:
        artifact = get_model_artifact()
        df = get_match_dataset()
        return jsonify({
            "status": "healthy",
            "service": "Total Goals Linear Regression API",
            "model_type": artifact.get("model_type", "LinearRegression"),
            "dataset_rows": len(df),
            "metrics": artifact.get("metrics", {}),
            "port": PORT
        })
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500


@app.route("/api/total-goals/predict", methods=["GET", "POST"])
def predict():
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        home_team = data.get("home_team") or data.get("home")
        away_team = data.get("away_team") or data.get("away")
    else:
        home_team = request.args.get("home_team") or request.args.get("home")
        away_team = request.args.get("away_team") or request.args.get("away")

    if not home_team or not away_team:
        return jsonify({
            "success": False,
            "error": "Missing parameters. Please provide 'home' and 'away' team names."
        }), 400

    result = predict_total_goals(home_team, away_team)
    status_code = 200 if result.get("success", False) else 404
    return jsonify(result), status_code


def start_server():
    print(f"\n=======================================================")
    print(f"  Starting Expected Total Goals Service on http://{HOST}:{PORT}")
    print(f"  Linear Regression Model (xG Total Goals Prediction)")
    print(f"=======================================================\n")
    app.run(host=HOST, port=PORT, debug=False)


if __name__ == "__main__":
    start_server()
