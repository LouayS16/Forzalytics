import os
import joblib
import numpy as np

from pathlib import Path

def _resolve_model_path():
    try:
        from backend.config import MODEL_PATH
        if os.path.exists(MODEL_PATH):
            return MODEL_PATH
    except Exception:
        pass
    
    candidates = [
        Path(__file__).resolve().parent.parent.parent / "ml" / "models" / "model_3way.joblib",
        Path(__file__).resolve().parent.parent.parent.parent / "ml" / "models" / "model_3way.joblib",
        Path("ml/models/model_3way.joblib"),
        Path("model_3way.joblib"),
    ]
    for p in candidates:
        if p.exists():
            return str(p)
    return "ml/models/model_3way.joblib"

MODEL_PATH = _resolve_model_path()
_MODEL_INSTANCE = None


def load_model(path: str = None):
    global _MODEL_INSTANCE
    target_path = path or MODEL_PATH
    if _MODEL_INSTANCE is None:
        if os.path.exists(target_path):
            print(f"Loading cached 3-class LightGBM model from '{target_path}'...")
            _MODEL_INSTANCE = joblib.load(target_path)
        else:
            raise FileNotFoundError(f"Model file '{target_path}' not found. Please train it first.")
    return _MODEL_INSTANCE


def predict_outcome(features_df):
    """
    Run 3-class prediction on input feature dataframe row.
    Returns:
    - predicted_outcome: "Home Win" | "Draw" | "Away Win"
    - probabilities: { "home_win": float, "draw": float, "away_win": float }
    """
    model = load_model()
    probs = model.predict_proba(features_df)[0]
    
    # 0 = Home Win, 1 = Draw, 2 = Away Win
    p_home = float(probs[0])
    p_draw = float(probs[1])
    p_away = float(probs[2])

    pred_idx = int(np.argmax(probs))
    label_map = {0: "Home Win", 1: "Draw", 2: "Away Win"}
    predicted_outcome = label_map[pred_idx]

    return {
        "predicted_outcome": predicted_outcome,
        "probabilities": {
            "home_win": round(p_home, 3),
            "draw": round(p_draw, 3),
            "away_win": round(p_away, 3),
        },
        "model_type": "LightGBM 3-Class Multiclass Classifier",
        "classes": ["Home Win", "Draw", "Away Win"],
    }
