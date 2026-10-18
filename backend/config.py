import os
from pathlib import Path
from dotenv import load_dotenv

# Base directory (repository root)
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from root .env
load_dotenv(BASE_DIR / ".env")

BACKEND_DIR = BASE_DIR / "backend"
ML_DIR = BASE_DIR / "ml"

def get_dataset_path() -> str:
    """Resolve cleaned match dataset path with fallbacks."""
    candidates = [
        ML_DIR / "data" / "cleaned_dataset.csv",
        BASE_DIR / "cleaned_dataset.csv",
    ]
    for p in candidates:
        if p.exists():
            return str(p)
    return str(ML_DIR / "data" / "cleaned_dataset.csv")

def get_model_path() -> str:
    """Resolve trained LightGBM model artifact path with fallbacks."""
    candidates = [
        ML_DIR / "models" / "model_3way.joblib",
        BASE_DIR / "model_3way.joblib",
    ]
    for p in candidates:
        if p.exists():
            return str(p)
    return str(ML_DIR / "models" / "model_3way.joblib")

def get_history_file_path() -> str:
    """Resolve prediction history log path."""
    backend_history = BACKEND_DIR / "prediction_history.json"
    if backend_history.exists():
        return str(backend_history)
    root_history = BASE_DIR / "prediction_history.json"
    if root_history.exists():
        return str(root_history)
    return str(backend_history)

INJURY_DATASET_PATH = str(ML_DIR / "data" / "dataset_risque_blessure.csv")
INJURY_LOG_PATH = str(ML_DIR / "data" / "blessures.csv")
INJURY_MODEL_PATH = str(ML_DIR / "models" / "injury_risk.joblib")

DATASET_PATH = get_dataset_path()
MODEL_PATH = get_model_path()
HISTORY_FILE = get_history_file_path()

PORT = int(os.getenv("PORT", 5000))
HOST = os.getenv("HOST", "127.0.0.1")
