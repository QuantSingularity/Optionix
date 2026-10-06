import argparse
import logging
from typing import Dict, Optional

from ..config import ARTIFACT_DIR, DEFAULT_HORIZON
from ..volatility.artifacts import save_artifacts
from ..volatility.dataset import build_dataset
from ..volatility.training import train_pipeline
from .synthetic import synthetic_ohlc

logger = logging.getLogger(__name__)


def generate(output_dir: Optional[str] = None, bars: int = 6000) -> Dict[str, object]:
    target_dir = str(output_dir or ARTIFACT_DIR)
    frame = synthetic_ohlc(bars)
    features, target = build_dataset(frame, DEFAULT_HORIZON)
    pipeline, metrics = train_pipeline(features, target)
    metadata = save_artifacts(
        target_dir,
        pipeline,
        metrics,
        description=(
            "Volatility model trained on synthetic Heston OHLC bars. "
            "Retrain on real market data for production use."
        ),
        horizon=DEFAULT_HORIZON,
        extra={
            "training_samples": int(len(features)),
            "data_source": "synthetic_heston",
        },
    )
    logger.info(
        "Artifacts written to %s (test R2=%.3f)", target_dir, metrics["test_r2"]
    )
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Optionix model artifacts")
    parser.add_argument("--output", default=str(ARTIFACT_DIR))
    parser.add_argument("--bars", type=int, default=6000)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    generate(args.output, args.bars)


if __name__ == "__main__":
    main()
