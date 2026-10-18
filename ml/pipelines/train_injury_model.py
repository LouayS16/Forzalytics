"""
train_injury_model.py
Trains the player injury-risk classifier (from the "projet esprit" notebook) and saves it
to ml/models/injury_risk.joblib for the Flask backend.

One row of dataset_risque_blessure.csv = one player-month. Target = injured during the
following month (risque != 'aucun'). Split is chronological: train < 2020-07,
valid 2020-07..2021-06 (used for the risk-level thresholds), test >= 2021-07.

Run:  python ml/pipelines/train_injury_model.py
"""
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT_DIR / "ml" / "data" / "dataset_risque_blessure.csv"
MODEL_PATH = ROOT_DIR / "ml" / "models" / "injury_risk.joblib"

NUM_COLS = ["matchs_30j", "matchs_90j", "titularisations_90j", "jours_depuis_dernier_match",
            "note_moy_5", "note_moy_saison", "nb_blessures_avant", "nb_blessures_365j",
            "jours_absence_365j", "nb_blessures_graves_avant", "jours_depuis_derniere_blessure",
            "height", "age"]
CAT_COLS = ["main_position", "foot", "league"]

# Best hyper-parameters found by the grid search in the notebook (validation AUC)
BEST_PARAMS = dict(learning_rate=0.1, max_iter=400, max_leaf_nodes=15, min_samples_leaf=50)

TRAIN_END, VALID_END = "2020-07", "2021-07"


def build_pipeline():
    preparation = ColumnTransformer([
        ("num", Pipeline([("imputer", SimpleImputer(strategy="median", add_indicator=True)),
                          ("scaler", StandardScaler())]), NUM_COLS),
        ("cat", Pipeline([("imputer", SimpleImputer(strategy="most_frequent")),
                          ("onehot", OneHotEncoder(handle_unknown="ignore"))]), CAT_COLS),
    ])
    return Pipeline([("prep", preparation),
                     ("modele", HistGradientBoostingClassifier(random_state=42, **BEST_PARAMS))])


def main():
    df = pd.read_csv(DATA_PATH)
    df["blesse"] = (df["risque"] != "aucun").astype(int)
    train = df[df["mois"] < TRAIN_END]
    valid = df[(df["mois"] >= TRAIN_END) & (df["mois"] < VALID_END)]
    test = df[df["mois"] >= VALID_END]
    cols = NUM_COLS + CAT_COLS

    # Risk-level thresholds = 50th / 80th percentile of validation probabilities
    modele_val = build_pipeline().fit(train[cols], train["blesse"])
    proba_valid = modele_val.predict_proba(valid[cols])[:, 1]
    seuil_1, seuil_2 = np.quantile(proba_valid, [0.5, 0.8])

    modele = build_pipeline().fit(pd.concat([train[cols], valid[cols]]),
                                  pd.concat([train["blesse"], valid["blesse"]]))
    proba_test = modele.predict_proba(test[cols])[:, 1]
    auc = roc_auc_score(test["blesse"], proba_test)

    niveaux = pd.cut(proba_test, [-0.01, seuil_1, seuil_2, 1.01], labels=["low", "medium", "high"])
    taux = test.assign(niveau=niveaux).groupby("niveau", observed=True)["blesse"].mean()

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({
        "model": modele,
        "thresholds": (float(seuil_1), float(seuil_2)),
        "num_cols": NUM_COLS,
        "cat_cols": CAT_COLS,
        "test_start": VALID_END,
        "metrics": {"auc_test": round(float(auc), 3),
                    "injury_rate_by_level": {k: round(float(v), 3) for k, v in taux.items()},
                    "base_rate": round(float(test["blesse"].mean()), 3)},
    }, MODEL_PATH)
    print(f"Thresholds: {seuil_1:.3f} / {seuil_2:.3f} | AUC test: {auc:.3f}")
    print(taux.round(3))
    print(f"Saved model to {MODEL_PATH}")


if __name__ == "__main__":
    main()
