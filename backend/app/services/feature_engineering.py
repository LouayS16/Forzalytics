import pandas as pd
import numpy as np

FEATURE_COLS = [
    "synthetic_power_diff",
    "home_form_pts_l5", "away_form_pts_l5", "diff_form_pts_l5",
    "home_avg_gf_l5", "home_avg_ga_l5", "away_avg_gf_l5", "away_avg_ga_l5", "diff_avg_gd_l5",
    "home_avg_shots_l5", "away_avg_shots_l5",
    "home_avg_sot_l5", "away_avg_sot_l5", "diff_avg_sot_l5",
    "home_avg_poss_l5", "away_avg_poss_l5", "diff_avg_poss_l5",
    "home_avg_corners_l5", "away_avg_corners_l5",
    "home_avg_fouls_l5", "away_avg_fouls_l5",
]


def build_pre_match_features(home_summary: dict, away_summary: dict, home_team_name: str, away_team_name: str):
    """
    Construct exact 21 pre-kickoff feature vector matching trained model specification.
    """
    h_gf = home_summary["avg_goals_for"]
    h_ga = home_summary["avg_goals_against"]
    a_gf = away_summary["avg_goals_for"]
    a_ga = away_summary["avg_goals_against"]

    diff_gd = (h_gf - h_ga) - (a_gf - a_ga)
    
    h_sot = home_summary["avg_shots_on_target"] if home_summary["avg_shots_on_target"] is not None else 4.0
    a_sot = away_summary["avg_shots_on_target"] if away_summary["avg_shots_on_target"] is not None else 3.5
    diff_sot = h_sot - a_sot

    h_poss = home_summary["avg_possession"] if home_summary["avg_possession"] is not None else 51.0
    a_poss = away_summary["avg_possession"] if away_summary["avg_possession"] is not None else 49.0
    diff_poss = h_poss - a_poss

    diff_pts = home_summary["points"] - away_summary["points"]

    # Pre-kickoff Relative Team Power Index with home ground factor
    power_diff = (diff_gd * 0.40) + (diff_sot * 0.15) + (diff_pts * 0.05) + 0.30

    feat_dict = {
        "synthetic_power_diff": float(power_diff),
        "home_form_pts_l5": float(home_summary["points"]),
        "away_form_pts_l5": float(away_summary["points"]),
        "diff_form_pts_l5": float(diff_pts),
        "home_avg_gf_l5": float(h_gf),
        "home_avg_ga_l5": float(h_ga),
        "away_avg_gf_l5": float(a_gf),
        "away_avg_ga_l5": float(a_ga),
        "diff_avg_gd_l5": float(diff_gd),
        "home_avg_shots_l5": float(home_summary["avg_shots"] if home_summary["avg_shots"] is not None else 11.0),
        "away_avg_shots_l5": float(away_summary["avg_shots"] if away_summary["avg_shots"] is not None else 10.0),
        "home_avg_sot_l5": float(h_sot),
        "away_avg_sot_l5": float(a_sot),
        "diff_avg_sot_l5": float(diff_sot),
        "home_avg_poss_l5": float(h_poss),
        "away_avg_poss_l5": float(a_poss),
        "diff_avg_poss_l5": float(diff_poss),
        "home_avg_corners_l5": float(home_summary["avg_corners"] if home_summary["avg_corners"] is not None else 5.0),
        "away_avg_corners_l5": float(away_summary["avg_corners"] if away_summary["avg_corners"] is not None else 4.0),
        "home_avg_fouls_l5": float(home_summary["avg_fouls"] if home_summary["avg_fouls"] is not None else 12.0),
        "away_avg_fouls_l5": float(away_summary["avg_fouls"] if away_summary["avg_fouls"] is not None else 13.0),
    }

    # Generate analytical key drivers
    drivers = []
    if diff_gd >= 0.6:
        drivers.append(f"{home_team_name} holds an elite goal difference edge (+{diff_gd:.1f} net margin/match) in recent games.")
    elif diff_gd <= -0.6:
        drivers.append(f"{away_team_name} carries superior offensive/defensive form (+{abs(diff_gd):.1f} net GD differential).")

    if diff_sot >= 1.2:
        drivers.append(f"{home_team_name} generates significantly higher shots on target volume ({h_sot:.1f} vs {a_sot:.1f}).")
    elif diff_sot <= -1.2:
        drivers.append(f"{away_team_name} threatens with higher target accuracy on the counter ({a_sot:.1f} SOT/game).")

    if diff_pts >= 4:
        drivers.append(f"{home_team_name} leads recent form points by +{diff_pts} pts over the last 5 outings.")
    elif diff_pts <= -4:
        drivers.append(f"{away_team_name} in stronger point-scoring momentum (+{abs(diff_pts)} pts advantage).")

    if abs(diff_gd) <= 0.3 and abs(diff_pts) <= 2:
        drivers.append("Both clubs display closely balanced defensive metrics, elevating the draw probability.")

    if not drivers:
        drivers.append("Evenly matched historical momentum across both squads.")

    input_df = pd.DataFrame([feat_dict])[FEATURE_COLS]
    return input_df, feat_dict, drivers
