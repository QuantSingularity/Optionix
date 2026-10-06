import argparse
import logging
import os
from typing import Dict

from ..config import ARTIFACT_DIR, DEFAULT_HORIZON
from ..volatility.artifacts import save_artifacts
from ..volatility.dataset import build_dataset
from ..volatility.training import train_pipeline
from .data_preprocessing import load_market_csv

logger = logging.getLogger(__name__)

DEFAULT_OUTPUT_DIR = str(ARTIFACT_DIR)


def train_model(
    data_path: str,
    output_dir: str = DEFAULT_OUTPUT_DIR,
    horizon: int = DEFAULT_HORIZON,
) -> Dict[str, object]:
    if not os.path.isfile(data_path):
        raise FileNotFoundError(data_path)
    frame = load_market_csv(data_path)
    features, target = build_dataset(frame, horizon)
    pipeline, metrics = train_pipeline(features, target)
    metadata = save_artifacts(
        output_dir,
        pipeline,
        metrics,
        description=f"Volatility model trained on {os.path.basename(data_path)}",
        horizon=horizon,
        extra={"training_samples": int(len(features)), "data_source": "csv"},
    )
    logger.info("Model saved to %s (test R2=%.3f)", output_dir, metrics["test_r2"])
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser(description="Train Optionix volatility model")
    parser.add_argument(
        "--data", required=True, help="CSV with open, high, low, close, volume"
    )
    parser.add_argument(
        "--output", default=DEFAULT_OUTPUT_DIR, help="Artifact directory"
    )
    parser.add_argument("--horizon", type=int, default=DEFAULT_HORIZON)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    train_model(args.data, args.output, args.horizon)


if __name__ == "__main__":
    main()
