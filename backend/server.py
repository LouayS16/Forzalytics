import os
import sys
import json
from datetime import datetime, timezone
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS

# Add root and backend to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))
BACKEND_DIR = BASE_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from backend.config import DATASET_PATH, MODEL_PATH, HISTORY_FILE, PORT, HOST
from backend.app.services.football_provider import (
    COMPETITIONS,
    get_upcoming_fixtures,
    get_fixture_by_id,
    clean_team_name,
    get_league_standings,
    get_team_details_and_squad,
)
from backend.app.services.match_history import (
    get_dataset,
    retrieve_last_five_matches,
)
from backend.app.services.feature_engineering import build_pre_match_features
from backend.app.services.model_service import load_model, predict_outcome

app = Flask(__name__)
CORS(app)


@app.route("/api/health", methods=["GET"])
def health():
    try:
        df = get_dataset()
        model = load_model()
        return jsonify({
            "status": "healthy",
            "dataset_rows": len(df),
            "model_loaded": model is not None,
            "provider": "OpenFootball (100% Free Live Match Schedule)",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500


@app.route("/api/competitions", methods=["GET"])
def get_competitions_list():
    return jsonify({"competitions": COMPETITIONS})


@app.route("/api/competitions/<comp_id>/standings", methods=["GET"])
def get_competition_standings(comp_id):
    try:
        standings_data = get_league_standings(comp_id)
        return jsonify(standings_data)
    except Exception as e:
        return jsonify({"error": f"Failed to retrieve standings: {str(e)}"}), 500


@app.route("/api/teams/<path:team_identifier>", methods=["GET"])
def get_team_profile(team_identifier):
    try:
        competition = request.args.get("competition")
        team_data = get_team_details_and_squad(team_identifier, competition_id=competition)
        return jsonify(team_data)
    except Exception as e:
        return jsonify({"error": f"Failed to retrieve team profile: {str(e)}"}), 500



@app.route("/api/fixtures/upcoming", methods=["GET"])
def upcoming_fixtures():
    competition = request.args.get("competition")
    if competition in ["all", "", "ALL"]:
        competition = None
    search = request.args.get("search")
    round_name = request.args.get("round")
    date_str = request.args.get("date")
    limit = int(request.args.get("limit", 250))

    fixtures = get_upcoming_fixtures(
        competition=competition,
        search=search,
        round_name=round_name,
        date_str=date_str,
        limit=limit
    )
    return jsonify({
        "total": len(fixtures),
        "competition": competition or "all",
        "fixtures": fixtures
    })


@app.route("/api/fixtures/<fixture_id>", methods=["GET"])
def get_fixture_details(fixture_id):
    fixture = get_fixture_by_id(fixture_id)
    if not fixture:
        return jsonify({"error": f"Fixture '{fixture_id}' not found."}), 404
    return jsonify({"fixture": fixture})


@app.route("/api/fixtures/<fixture_id>/history", methods=["GET"])
def get_fixture_history(fixture_id):
    fixture = get_fixture_by_id(fixture_id)
    if not fixture:
        return jsonify({"error": f"Fixture '{fixture_id}' not found."}), 404

    home_team = fixture["homeTeam"]["normalizedName"]
    away_team = fixture["awayTeam"]["normalizedName"]
    kickoff_utc = fixture["kickoffUtc"]

    home_matches, home_summary = retrieve_last_five_matches(home_team, kickoff_utc, n=5)
    away_matches, away_summary = retrieve_last_five_matches(away_team, kickoff_utc, n=5)

    return jsonify({
        "fixture": fixture,
        "home_team": home_team,
        "away_team": away_team,
        "home_matches": home_matches,
        "away_matches": away_matches,
        "home_summary": home_summary,
        "away_summary": away_summary,
    })


@app.route("/api/predictions", methods=["POST"])
@app.route("/api/predict", methods=["POST"])  # alias for backwards compatibility
def make_prediction():
    data = request.get_json() or {}
    fixture_id = data.get("fixtureId") or data.get("fixture_id")

    # If fixtureId is provided
    if fixture_id:
        fixture = get_fixture_by_id(fixture_id)
        if not fixture:
            return jsonify({"error": f"Fixture '{fixture_id}' not found in live fixture feed."}), 404

        home_team = fixture["homeTeam"]["normalizedName"]
        away_team = fixture["awayTeam"]["normalizedName"]
        kickoff_utc = fixture["kickoffUtc"]
        match_title = f"{fixture['homeTeam']['name']} vs {fixture['awayTeam']['name']}"
        competition_name = fixture["competitionName"]
    else:
        # Fallback to direct team names
        raw_home = data.get("home_team", "").strip()
        raw_away = data.get("away_team", "").strip()
        if not raw_home or not raw_away:
            return jsonify({"error": "Either fixtureId or (home_team, away_team) must be supplied."}), 400
        
        home_team = clean_team_name(raw_home)
        away_team = clean_team_name(raw_away)
        kickoff_utc = data.get("match_date") or datetime.now(timezone.utc).isoformat()
        match_title = f"{home_team} vs {away_team}"
        competition_name = data.get("league", "General").title()
        fixture = {
            "id": f"custom-{home_team.lower()}-{away_team.lower()}",
            "competitionName": competition_name,
            "kickoffUtc": kickoff_utc,
            "homeTeam": {"name": home_team, "normalizedName": home_team},
            "awayTeam": {"name": away_team, "normalizedName": away_team},
        }

    if home_team == away_team:
        return jsonify({"error": "Home and Away sides cannot be the same club."}), 400

    # 1. Retrieve last 5 matches strictly earlier than target kickoff (Anti-Leakage)
    home_matches, home_summary = retrieve_last_five_matches(home_team, kickoff_utc, n=5)
    away_matches, away_summary = retrieve_last_five_matches(away_team, kickoff_utc, n=5)

    if len(home_matches) == 0 or len(away_matches) == 0:
        missing = []
        if len(home_matches) == 0:
            missing.append(home_team)
        if len(away_matches) == 0:
            missing.append(away_team)
        missing_str = " and ".join(missing)
        return jsonify({
            "error": f"Cannot generate prediction: No verified match history found for {missing_str} prior to kickoff ({kickoff_utc[:10] if kickoff_utc else ''}). Predictions cannot be made for teams without data."
        }), 400

    # 2. Build feature vector exactly matching trained model contract
    features_df, feature_dict, key_drivers = build_pre_match_features(
        home_summary, away_summary, home_team, away_team
    )

    # 3. Model inference
    pred_res = predict_outcome(features_df)

    res_payload = {
        "fixture": fixture,
        "match": match_title,
        "home_team": home_team,
        "away_team": away_team,
        "competition": competition_name,
        "kickoff_utc": kickoff_utc,
        "predicted_outcome": pred_res["predicted_outcome"],
        "probabilities": pred_res["probabilities"],
        "key_drivers": key_drivers,
        "home_summary": home_summary,
        "away_summary": away_summary,
        "home_recent_matches": home_matches,
        "away_recent_matches": away_matches,
        "features_used": feature_dict,
        "data_source": "OpenFootball fixtures + 96,305 European Match Historical Dataset",
        "disclaimer": "Predictions are probabilistic statistical estimates based on pre-kickoff historical performance, not financial guarantees.",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    # Save to history
    save_history(res_payload)
    return jsonify(res_payload)


def save_history(entry):
    try:
        history = []
        if os.path.exists(HISTORY_FILE):
            with open(HISTORY_FILE, "r") as f:
                history = json.load(f)
        history.insert(0, {
            "id": datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f"),
            "match": entry["match"],
            "home_team": entry.get("home_team", ""),
            "away_team": entry.get("away_team", ""),
            "home_logo": entry.get("fixture", {}).get("homeTeam", {}).get("logo", ""),
            "away_logo": entry.get("fixture", {}).get("awayTeam", {}).get("logo", ""),
            "competition": entry.get("competition", "League"),
            "kickoff_utc": entry.get("kickoff_utc", ""),
            "predicted_outcome": entry["predicted_outcome"],
            "probabilities": entry["probabilities"],
            "key_drivers": entry.get("key_drivers", []),
            "timestamp": entry["timestamp"],
            "fixture": entry.get("fixture"),
        })
        history = history[:30]
        with open(HISTORY_FILE, "w") as f:
            json.dump(history, f, indent=2)
    except Exception as e:
        print(f"Notice: Failed saving history: {e}")


@app.route("/api/history", methods=["GET"])
def get_history_list():
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, "r") as f:
                return jsonify({"history": json.load(f)})
        except Exception:
            return jsonify({"history": []})
    return jsonify({"history": []})


def start_server():
    # Preload dataset & model on start
    get_dataset()
    load_model()
    print(f"Starting MatchPredict Real-Time API Server on http://{HOST}:{PORT} ...")
    app.run(host=HOST, port=PORT, debug=False)


if __name__ == "__main__":
    start_server()
