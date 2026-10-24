import sys
from pathlib import Path
import joblib
import pandas as pd
from lightgbm import LGBMClassifier
from sklearn.metrics import roc_auc_score, f1_score, brier_score_loss, classification_report

sys.path.insert(0, str(Path(__file__).resolve().parent))
from train_model import build_rolling_features, _resolve_dataset_path, ML_DIR

# Pre-kickoff features only (rolling last-5, shift(1)). No synthetic_power_diff, no match stats.
FEATURES = [
    "home_form_pts_l5", "away_form_pts_l5", "diff_form_pts_l5",
    "home_avg_gf_l5", "home_avg_ga_l5", "away_avg_gf_l5", "away_avg_ga_l5", "diff_avg_gd_l5",
    "home_avg_shots_l5", "away_avg_shots_l5",
    "home_avg_sot_l5", "away_avg_sot_l5", "diff_avg_sot_l5",
    "home_avg_poss_l5", "away_avg_poss_l5", "diff_avg_poss_l5",
    "home_avg_corners_l5", "away_avg_corners_l5",
    "home_avg_fouls_l5", "away_avg_fouls_l5",
]

def fit_eval(train, test, target, name):
    m = LGBMClassifier(n_estimators=250, learning_rate=0.03, max_depth=4,
                       random_state=42, verbosity=-1)   # class_weight removed
    m.fit(train[FEATURES], train[target])

    proba = m.predict_proba(test[FEATURES])[:, 1]

    threshold = train[target].mean()               # clean sheet rate in TRAIN
    pred = (proba >= threshold).astype(int)        # replaces the old (proba >= 0.5)

    base = 1 - test[target].mean()
    print(f"\n=== {name} ===")
    print(f"Clean sheet rate (test)  : {test[target].mean():.3f}")
    print(f"Threshold used           : {threshold:.3f}")
    print(f"Baseline acc (always 0)  : {base:.3f}")
    print(f"ROC-AUC                  : {roc_auc_score(test[target], proba):.3f}")
    print(f"Brier                    : {brier_score_loss(test[target], proba):.3f}")
    print(f"F1 (clean sheet)         : {f1_score(test[target], pred):.3f}")
    print(classification_report(test[target], pred, target_names=["Conceded", "Clean sheet"]))
    return m

def main():
    df = pd.read_csv(_resolve_dataset_path(), low_memory=False)
    df["datetime"] = pd.to_datetime(df["datetime"])
    df = build_rolling_features(df)

    # Targets
    df["home_cs"] = (df["away_score"] == 0).astype(int)
    df["away_cs"] = (df["home_score"] == 0).astype(int)

    # Chronological split: train on the past, test on the most recent 20%
    df = df.sort_values("datetime").reset_index(drop=True)
    cut = int(len(df) * 0.8)
    train, test = df.iloc[:cut], df.iloc[cut:]
    print(f"Train={len(train):,}  Test={len(test):,}")
    print(f"Train until {train['datetime'].max().date()}, test from {test['datetime'].min().date()}")

    model_home = fit_eval(train, test, "home_cs", "Home clean sheet")
    model_away = fit_eval(train, test, "away_cs", "Away clean sheet")

    out = ML_DIR / "models" / "model_cleansheet.joblib"
    joblib.dump({"home": model_home, "away": model_away, "features": FEATURES}, out)
    print(f"\n[OK] Saved to {out}")

if __name__ == "__main__":
    main()