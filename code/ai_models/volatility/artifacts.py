import hashlib
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import joblib
from sklearn.pipeline import Pipeline

from ..config import (
    ARTIFACT_DIR,
    DEFAULT_HORIZON,
    METADATA_FILENAME,
    MODEL_FILENAME,
    MODEL_VERSION,
    TARGET_NAME,
)
from .features import FEATURE_NAMES

logger = logging.getLogger(__name__)


def sha256_file(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def save_artifacts(
    output_dir: Optional[str],
    pipeline: Pipeline,
    metrics: Dict[str, float],
    description: str,
    version: str = MODEL_VERSION,
    horizon: int = DEFAULT_HORIZON,
    extra: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    output_dir = str(output_dir or ARTIFACT_DIR)
    os.makedirs(output_dir, exist_ok=True)
    model_path = os.path.join(output_dir, MODEL_FILENAME)
    joblib.dump(pipeline, model_path)
    metadata: Dict[str, Any] = {
        "model_type": type(pipeline.named_steps["model"]).__name__,
        "version": version,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "features": list(FEATURE_NAMES),
        "target": TARGET_NAME,
        "target_unit": "per_bar_log_return_std",
        "horizon_bars": horizon,
        "metrics": metrics,
        "description": description,
        "artifact": MODEL_FILENAME,
        "artifact_sha256": sha256_file(model_path),
    }
    if extra:
        metadata.update(extra)
    with open(os.path.join(output_dir, METADATA_FILENAME), "w", encoding="utf-8") as h:
        json.dump(metadata, h, indent=2)
    return metadata
