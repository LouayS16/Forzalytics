import os
import numpy as np
import pandas as pd


def derive_season(dt):
    """Derive European football season string from datetime (e.g. 2011/2012)."""
    if pd.isnull(dt):
        return None
    year = dt.year
    month = dt.month
    if month >= 7:
        return f"{year}/{year + 1}"
    else:
        return f"{year - 1}/{year}"


from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ML_DATA_DIR = BASE_DIR / "ml" / "data"

def create_cleaned_dataset(
    raw_path: str = None,
    output_path: str = None,
):
    if raw_path is None:
        candidates = [ML_DATA_DIR / "full_data.csv", BASE_DIR / "full_data.csv", Path("full_data.csv")]
        raw_path = next((str(p) for p in candidates if p.exists()), str(ML_DATA_DIR / "full_data.csv"))
    if output_path is None:
        output_path = str(ML_DATA_DIR / "cleaned_dataset.csv")

    print("=" * 80)
    print("PRODUCING FULLY CLEANED & COMPLETE DATASET (ZERO MISSING VALUES)")
    print("=" * 80)

    # 1. Load raw dataset
    print(f"Loading raw dataset from '{raw_path}'...")
    df = pd.read_csv(raw_path, low_memory=False)
    print(f"Initial raw matches: {len(df):,}")

    # 2. Extract clean match_id
    print("Extracting clean match_id from Game Link...")
    df["match_id"] = df["Game Link"].str.extract(r"match/([^/]+)/")

    # 3. Standardize Datetime & Season
    print("Standardizing dates and timestamps...")
    df["datetime"] = pd.to_datetime(
        df["Date"] + " " + df["Time"], format="%d.%m.%Y %H:%M", errors="coerce"
    )
    df["date"] = df["datetime"].dt.strftime("%Y-%m-%d")
    df["time"] = df["datetime"].dt.strftime("%H:%M")
    df["season"] = df["datetime"].apply(derive_season)

    # 4. Handle Red Cards from incident logs (INC)
    print("Parsing red cards from incident logs...")
    def parse_reds(inc_val):
        if not isinstance(inc_val, str) or not inc_val.strip():
            return 0, 0
        return inc_val.count("Red_Card_Home"), inc_val.count("Red_Card_Away")

    red_tuples = [parse_reds(s) for s in df["INC"]]
    df["home_red_cards"] = [t[0] for t in red_tuples]
    df["away_red_cards"] = [t[1] for t in red_tuples]

    # 5. Clean Possession from percentage strings ('52%' -> 52.0)
    print("Standardizing possession statistics...")
    for col in ["H_Ball_Possession", "A_Ball_Possession"]:
        df[col] = (
            df[col]
            .astype(str)
            .str.replace("%", "", regex=False)
            .replace("nan", np.nan)
        )
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # 6. Drop unplayed/abandoned matches missing target scores
    print("Filtering unplayed/abandoned matches...")
    valid_mask = df["WIN"].notnull() & df["H_Score"].notnull() & df["A_Score"].notnull()
    dropped_unplayed = (~valid_mask).sum()
    df = df[valid_mask].copy()
    print(f"Dropped {dropped_unplayed} unplayed/abandoned matches. Remaining: {len(df):,}")

    # Targets encoding
    target_map = {"Home": 0, "Draw": 1, "Away": 2}
    df["target"] = df["WIN"].map(target_map).astype(int)
    # Double Chance target: 1 = Home or Draw, 0 = Away Win
    df["target_1x"] = np.where(df["WIN"].isin(["Home", "Draw"]), 1, 0)
    # Two-Class Home vs Away target (Draw No Bet): 1 = Home, 0 = Away, -1 = Draw
    df["target_home_away"] = np.where(df["WIN"] == "Home", 1, np.where(df["WIN"] == "Away", 0, -1))

    # 7. Initial Column Mapping
    cleaned_df = pd.DataFrame({
        "match_id": df["match_id"],
        "league": df["League"].str.lower().str.strip(),
        "season": df["season"],
        "date": df["date"],
        "time": df["time"],
        "datetime": df["datetime"],
        "round": df["Round"],
        "home_team": df["Home"].str.strip(),
        "away_team": df["Away"].str.strip(),
        "home_score": df["H_Score"].astype(int),
        "away_score": df["A_Score"].astype(int),
        "ht_home_score": pd.to_numeric(df["HT_H_Score"], errors="coerce"),
        "ht_away_score": pd.to_numeric(df["HT_A_Score"], errors="coerce"),
        "result": df["WIN"],
        "target": df["target"],
        "target_1x": df["target_1x"],
        "target_home_away": df["target_home_away"],
        "odds_home": pd.to_numeric(df["H_BET"], errors="coerce"),
        "odds_draw": pd.to_numeric(df["X_BET"], errors="coerce"),
        "odds_away": pd.to_numeric(df["A_BET"], errors="coerce"),
        "home_possession": df["H_Ball_Possession"],
        "away_possession": df["A_Ball_Possession"],
        "home_shots": pd.to_numeric(df["H_Goal_Attempts"], errors="coerce"),
        "away_shots": pd.to_numeric(df["A_Goal_Attempts"], errors="coerce"),
        "home_shots_on_target": pd.to_numeric(df["H_Shots_on_Goal"], errors="coerce"),
        "away_shots_on_target": pd.to_numeric(df["A_Shots_on_Goal"], errors="coerce"),
        "home_shots_off_target": pd.to_numeric(df["H_Shots_off_Goal"], errors="coerce"),
        "away_shots_off_target": pd.to_numeric(df["A_Shots_off_Goal"], errors="coerce"),
        "home_corners": pd.to_numeric(df["H_Corner_Kicks"], errors="coerce"),
        "away_corners": pd.to_numeric(df["A_Corner_Kicks"], errors="coerce"),
        "home_fouls": pd.to_numeric(df["H_Fouls"], errors="coerce"),
        "away_fouls": pd.to_numeric(df["A_Fouls"], errors="coerce"),
        "home_yellow_cards": pd.to_numeric(df["H_Yellow_Cards"], errors="coerce"),
        "away_yellow_cards": pd.to_numeric(df["A_Yellow_Cards"], errors="coerce"),
        "home_red_cards": df["home_red_cards"].astype(int),
        "away_red_cards": df["away_red_cards"].astype(int),
        "home_saves": pd.to_numeric(df["H_Goalkeeper_Saves"], errors="coerce"),
        "away_saves": pd.to_numeric(df["A_Goalkeeper_Saves"], errors="coerce"),
        "home_offsides": pd.to_numeric(df["H_Offsides"], errors="coerce"),
        "away_offsides": pd.to_numeric(df["A_Offsides"], errors="coerce"),
    })

    print("\n--- HANDLING ALL MISSING DATA (GENERATING REALISTIC ESTIMATES) ---")
    missing_before = cleaned_df.isnull().sum().sum()
    print(f"Total missing values to impute: {missing_before:,}")

    # A) Missing Odds & Implied Probabilities
    print("1/5 Imputing missing odds and market probabilities...")
    league_res_odds = cleaned_df.groupby(["league", "result"])[["odds_home", "odds_draw", "odds_away"]].transform("median")
    global_odds = cleaned_df[["odds_home", "odds_draw", "odds_away"]].median()
    for col in ["odds_home", "odds_draw", "odds_away"]:
        cleaned_df[col] = cleaned_df[col].fillna(league_res_odds[col]).fillna(global_odds[col]).round(2)

    cleaned_df["prob_home"] = (1.0 / cleaned_df["odds_home"]).round(4)
    cleaned_df["prob_draw"] = (1.0 / cleaned_df["odds_draw"]).round(4)
    cleaned_df["prob_away"] = (1.0 / cleaned_df["odds_away"]).round(4)

    # B) Coupled Ball Possession (home_possession + away_possession == 100%)
    print("2/5 Generating coupled team possession (strictly sum to 100%)...")
    h_poss_team = cleaned_df.groupby("home_team")["home_possession"].transform("mean")
    a_poss_team = cleaned_df.groupby("away_team")["away_possession"].transform("mean")
    lg_poss = cleaned_df.groupby("league")["home_possession"].transform("mean").fillna(51.5)
    gl_poss = 51.5

    est_poss = (h_poss_team.fillna(lg_poss) + (100.0 - a_poss_team.fillna(100.0 - lg_poss))) / 2.0
    cleaned_df["home_possession"] = cleaned_df["home_possession"].fillna(est_poss).fillna(gl_poss).round(1)
    cleaned_df["away_possession"] = (100.0 - cleaned_df["home_possession"]).round(1)

    # C) Shots on Target & Total Shots (strictly respecting: score <= shots_on_target <= total_shots)
    print("3/5 Generating consistent shooting statistics (shots >= shots_on_target >= goals)...")
    h_sot_base = cleaned_df.groupby("home_team")["home_shots_on_target"].transform("median").fillna(4.0)
    a_sot_base = cleaned_df.groupby("away_team")["away_shots_on_target"].transform("median").fillna(3.5)

    est_h_sot = np.maximum(cleaned_df["home_score"], np.round(cleaned_df["home_score"] + h_sot_base * 0.6))
    est_a_sot = np.maximum(cleaned_df["away_score"], np.round(cleaned_df["away_score"] + a_sot_base * 0.6))
    cleaned_df["home_shots_on_target"] = cleaned_df["home_shots_on_target"].fillna(est_h_sot).astype(float)
    cleaned_df["away_shots_on_target"] = cleaned_df["away_shots_on_target"].fillna(est_a_sot).astype(float)

    h_off_base = cleaned_df.groupby("home_team")["home_shots_off_target"].transform("median").fillna(5.0)
    a_off_base = cleaned_df.groupby("away_team")["away_shots_off_target"].transform("median").fillna(4.5)
    cleaned_df["home_shots_off_target"] = cleaned_df["home_shots_off_target"].fillna(np.round(h_off_base)).astype(float)
    cleaned_df["away_shots_off_target"] = cleaned_df["away_shots_off_target"].fillna(np.round(a_off_base)).astype(float)

    cleaned_df["home_shots"] = cleaned_df["home_shots"].fillna(cleaned_df["home_shots_on_target"] + cleaned_df["home_shots_off_target"]).astype(float)
    cleaned_df["away_shots"] = cleaned_df["away_shots"].fillna(cleaned_df["away_shots_on_target"] + cleaned_df["away_shots_off_target"]).astype(float)
    # Guarantee physical constraint: total shots >= shots on target
    cleaned_df["home_shots"] = np.maximum(cleaned_df["home_shots"], cleaned_df["home_shots_on_target"])
    cleaned_df["away_shots"] = np.maximum(cleaned_df["away_shots"], cleaned_df["away_shots_on_target"])

    # D) Goalkeeper Saves (consistent with opponent shots on target minus opponent score)
    print("4/5 Generating consistent goalkeeper saves...")
    est_a_saves = np.maximum(0, cleaned_df["home_shots_on_target"] - cleaned_df["home_score"])
    est_h_saves = np.maximum(0, cleaned_df["away_shots_on_target"] - cleaned_df["away_score"])
    cleaned_df["away_saves"] = cleaned_df["away_saves"].fillna(est_a_saves).astype(float)
    cleaned_df["home_saves"] = cleaned_df["home_saves"].fillna(est_h_saves).astype(float)

    # E) Corners, Fouls, Yellow Cards, Offsides, and Half-Time Scores
    print("5/5 Generating corners, fouls, disciplinary cards, offsides, and half-time scores...")
    h_corners = cleaned_df.groupby("home_team")["home_corners"].transform("median").fillna(5.0)
    a_corners = cleaned_df.groupby("away_team")["away_corners"].transform("median").fillna(4.0)
    cleaned_df["home_corners"] = cleaned_df["home_corners"].fillna(np.round(h_corners)).astype(float)
    cleaned_df["away_corners"] = cleaned_df["away_corners"].fillna(np.round(a_corners)).astype(float)

    h_fouls = cleaned_df.groupby("home_team")["home_fouls"].transform("median").fillna(13.0)
    a_fouls = cleaned_df.groupby("away_team")["away_fouls"].transform("median").fillna(14.0)
    cleaned_df["home_fouls"] = cleaned_df["home_fouls"].fillna(np.round(h_fouls)).astype(float)
    cleaned_df["away_fouls"] = cleaned_df["away_fouls"].fillna(np.round(a_fouls)).astype(float)

    h_yellows = cleaned_df.groupby("home_team")["home_yellow_cards"].transform("median").fillna(2.0)
    a_yellows = cleaned_df.groupby("away_team")["away_yellow_cards"].transform("median").fillna(2.0)
    cleaned_df["home_yellow_cards"] = cleaned_df["home_yellow_cards"].fillna(np.round(h_yellows)).astype(float)
    cleaned_df["away_yellow_cards"] = cleaned_df["away_yellow_cards"].fillna(np.round(a_yellows)).astype(float)

    h_offsides = cleaned_df.groupby("home_team")["home_offsides"].transform("median").fillna(2.0)
    a_offsides = cleaned_df.groupby("away_team")["away_offsides"].transform("median").fillna(2.0)
    cleaned_df["home_offsides"] = cleaned_df["home_offsides"].fillna(np.round(h_offsides)).astype(float)
    cleaned_df["away_offsides"] = cleaned_df["away_offsides"].fillna(np.round(a_offsides)).astype(float)

    # Half time score fallback (ensure <= full time score)
    cleaned_df["ht_home_score"] = cleaned_df["ht_home_score"].fillna(np.floor(cleaned_df["home_score"] / 2.0)).astype(int)
    cleaned_df["ht_away_score"] = cleaned_df["ht_away_score"].fillna(np.floor(cleaned_df["away_score"] / 2.0)).astype(int)

    # 8. Sort chronologically
    print("Sorting dataset strictly chronologically...")
    cleaned_df.sort_values(by=["datetime", "match_id"], ascending=[True, True], inplace=True)
    cleaned_df.reset_index(drop=True, inplace=True)

    # 9. Final Verification
    missing_after = cleaned_df.isnull().sum().sum()
    print("\n" + "=" * 80)
    print(f"VERIFICATION: Total missing values remaining: {missing_after}")
    assert missing_after == 0, f"Error: Still {missing_after} missing values in dataset!"
    print("SUCCESS: Zero empty spots across the entire dataset!")
    print("=" * 80)

    # 10. Save Cleaned Dataset (handling Windows Excel lock gracefully)
    try:
        print(f"Saving 100% complete dataset to '{output_path}'...")
        cleaned_df.to_csv(output_path, index=False)
        saved_file = output_path
    except PermissionError:
        fallback_path = "cleaned_dataset.csv"
        print(f"Notice: '{output_path}' is currently open/locked in another program (e.g. Excel).")
        print(f"Saving to fallback file '{fallback_path}' instead...")
        cleaned_df.to_csv(fallback_path, index=False)
        saved_file = fallback_path

    file_size_mb = os.path.getsize(saved_file) / (1024 * 1024)
    print(f"File Saved: {saved_file} ({file_size_mb:.2f} MB, {len(cleaned_df):,} rows x {len(cleaned_df.columns)} columns)")

    return cleaned_df


if __name__ == "__main__":
    create_cleaned_dataset()

