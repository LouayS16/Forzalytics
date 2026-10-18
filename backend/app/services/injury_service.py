"""
injury_service.py
Player search and monthly injury-risk inference, using the classifier trained by
ml/pipelines/train_injury_model.py on dataset_risque_blessure.csv (one row per player-month).
A prediction for month M is the risk of an injury during month M, from features known at its start.
"""
import difflib
import math
import threading
import unicodedata

import joblib
import numpy as np
import pandas as pd

from backend.config import INJURY_DATASET_PATH, INJURY_MODEL_PATH, INJURY_LOG_PATH

SEVERITY = {"aucun": None, "faible": "minor", "moyen": "moderate", "fort": "severe"}
TIMELINE_MONTHS = 24

_STATE = None
_LOCK = threading.Lock()


def _normalize(text):
    text = unicodedata.normalize("NFKD", str(text)).encode("ascii", "ignore").decode()
    return " ".join(text.lower().split())


def _clean(value):
    """JSON-safe scalar (NaN -> None, numpy -> python)."""
    if value is None:
        return None
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (float, np.floating)):
        return None if math.isnan(value) else round(float(value), 3)
    return value


def _load():
    global _STATE
    with _LOCK:
        if _STATE is not None:
            return _STATE
        bundle = joblib.load(INJURY_MODEL_PATH)
        df = pd.read_csv(INJURY_DATASET_PATH).sort_values(["player", "mois"]).reset_index(drop=True)
        cols = bundle["num_cols"] + bundle["cat_cols"]
        # Score every player-month once: makes timelines and lookups instant afterwards
        df["proba"] = bundle["model"].predict_proba(df[cols])[:, 1]
        seuil_1, seuil_2 = bundle["thresholds"]
        df["level"] = pd.cut(df["proba"], [-0.01, seuil_1, seuil_2, 1.01],
                             labels=["low", "medium", "high"]).astype(str)

        injuries = None
        try:
            injuries = pd.read_csv(INJURY_LOG_PATH, parse_dates=["from_date", "end_date"])
        except FileNotFoundError:
            pass

        last_rows = df.groupby("player").tail(1).set_index("player")
        months = df.groupby("player")["mois"].agg(["first", "last", "size"])
        index = {}
        for name in last_rows.index:
            index.setdefault(_normalize(name), []).append(name)

        _STATE = {"bundle": bundle, "df": df, "injuries": injuries,
                  "last_rows": last_rows, "months": months, "index": index}
        return _STATE


def warm_up():
    _load()


def _summary(state, name):
    row = state["last_rows"].loc[name]
    m = state["months"].loc[name]
    return {
        "name": name,
        "team": row["team"],
        "league": row["league"],
        "position": _clean(row["main_position"]),
        "age": _clean(row["age"]),
        "firstMonth": m["first"],
        "lastMonth": m["last"],
        "monthsTracked": int(m["size"]),
        "latestRisk": {"probability": _clean(row["proba"]), "level": row["level"]},
    }


def search_players(query, limit=20):
    state = _load()
    key = _normalize(query)
    if len(key) < 2:
        return []
    index = state["index"]
    contains = sorted({n for k, names in index.items() if key in k for n in names})
    close = [index[k][0] for k in difflib.get_close_matches(key, list(index), n=5, cutoff=0.75)]
    names = (contains + [n for n in close if n not in contains])[:limit]
    return [_summary(state, n) for n in names]


def get_player_risk(name, month=None):
    state = _load()
    df = state["df"]
    if name not in state["last_rows"].index:
        matches = state["index"].get(_normalize(name))
        if not matches:
            raise LookupError(f"Player '{name}' not found.")
        name = matches[0]

    rows = df[df["player"] == name]
    available = rows["mois"].tolist()
    month = month or available[-1]
    if month not in available:
        raise ValueError(f"No data for {name} in {month} (not playing or already injured).")
    row = rows[rows["mois"] == month].iloc[0]

    bundle = state["bundle"]
    seuil_1, seuil_2 = bundle["thresholds"]

    # Real outcome for that month
    month_injuries = []
    injuries = state["injuries"]
    if injuries is not None:
        player_inj = injuries[injuries["player_ratings"] == name].sort_values("from_date")
        in_month = player_inj[player_inj["from_date"].dt.strftime("%Y-%m") == month]
        month_injuries = [{"reason": r.injury_reason, "fromDate": r.from_date.strftime("%Y-%m-%d"),
                           "daysMissed": _clean(r.days_missed)} for r in in_month.itertuples()]
        before = player_inj[player_inj["from_date"].dt.strftime("%Y-%m") <= month].tail(8)
        history = [{"reason": r.injury_reason, "season": r.season_name,
                    "fromDate": r.from_date.strftime("%Y-%m-%d"),
                    "endDate": r.end_date.strftime("%Y-%m-%d") if pd.notna(r.end_date) else None,
                    "daysMissed": _clean(r.days_missed), "gamesMissed": _clean(r.games_missed)}
                   for r in before.iloc[::-1].itertuples()]
    else:
        history = []

    days_out = row["jours_absence_mois_suivant"]
    timeline_rows = rows[rows["mois"] <= month].tail(TIMELINE_MONTHS)

    return {
        "player": _summary(state, name),
        "month": month,
        "availableMonths": available,
        "team": row["team"],
        "league": row["league"],
        "profile": {
            "position": _clean(row["main_position"]),
            "foot": _clean(row["foot"]),
            "age": _clean(row["age"]),
            "height": _clean(row["height"]),
        },
        "prediction": {
            "probability": _clean(row["proba"]),
            "level": row["level"],
            "thresholds": {"medium": round(seuil_1, 3), "high": round(seuil_2, 3)},
            "baseRate": bundle["metrics"]["base_rate"],
        },
        "features": {
            "matches30d": _clean(row["matchs_30j"]),
            "matches90d": _clean(row["matchs_90j"]),
            "starts90d": _clean(row["titularisations_90j"]),
            "daysSinceLastMatch": _clean(row["jours_depuis_dernier_match"]),
            "avgRatingLast5": _clean(row["note_moy_5"]),
            "avgRatingSeason": _clean(row["note_moy_saison"]),
            "injuriesBefore": _clean(row["nb_blessures_avant"]),
            "injuries365d": _clean(row["nb_blessures_365j"]),
            "daysOut365d": _clean(row["jours_absence_365j"]),
            "seriousInjuriesBefore": _clean(row["nb_blessures_graves_avant"]),
            "daysSinceLastInjury": _clean(row["jours_depuis_derniere_blessure"]),
        },
        "outcome": {
            "known": pd.notna(days_out),
            "injured": bool(pd.notna(days_out) and days_out > 0),
            "daysOut": _clean(days_out),
            "severity": SEVERITY.get(row["risque"]),
            "injuries": month_injuries,
        },
        "isTrainingPeriod": month < bundle["test_start"],
        "timeline": [{"month": r.mois, "probability": _clean(r.proba), "level": r.level,
                      "injured": bool(r.jours_absence_mois_suivant > 0)}
                     for r in timeline_rows.itertuples()],
        "injuryHistory": history,
        "model": bundle["metrics"],
    }
