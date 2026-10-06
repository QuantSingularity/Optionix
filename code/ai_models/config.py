from pathlib import Path

MODEL_VERSION = "2.1.0"

PACKAGE_ROOT = Path(__file__).resolve().parent
ARTIFACT_DIR = PACKAGE_ROOT / "artifacts"

MODEL_FILENAME = "volatility_model.pkl"
METADATA_FILENAME = "volatility_model_metadata.json"
TARGET_NAME = "forward_realized_volatility"
DEFAULT_HORIZON = 10
RANDOM_STATE = 42
