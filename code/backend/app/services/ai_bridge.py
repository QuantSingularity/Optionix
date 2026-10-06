import importlib
import logging
import os
import sys
from pathlib import Path
from types import ModuleType
from typing import List, Optional

from ..config import settings

logger = logging.getLogger(__name__)

_SENTINEL = Path("quantitative") / "black_scholes.py"
_module: Optional[ModuleType] = None


def _candidate_dirs() -> List[Path]:
    here = Path(__file__).resolve()
    candidates: List[Path] = []
    for raw in (settings.ai_models_dir, os.environ.get("AI_MODELS_DIR")):
        if raw:
            candidates.append(Path(raw).expanduser().resolve())
    candidates.append(here.parents[2] / "ai_models")
    candidates.append(here.parents[3] / "ai_models")
    return candidates


def locate_ai_models_dir() -> Path:
    for candidate in _candidate_dirs():
        if (candidate / _SENTINEL).is_file():
            return candidate
    searched = ", ".join(str(c) for c in _candidate_dirs())
    raise ImportError(f"ai_models package not found; searched: {searched}")


def load_ai_models() -> ModuleType:
    global _module
    if _module is not None:
        return _module
    try:
        importlib.import_module("ai_models.quantitative.black_scholes")
        module = importlib.import_module("ai_models")
    except ImportError:
        directory = locate_ai_models_dir()
        parent = str(directory.parent)
        if parent not in sys.path:
            sys.path.insert(0, parent)
        for name in [
            n for n in sys.modules if n == "ai_models" or n.startswith("ai_models.")
        ]:
            del sys.modules[name]
        module = importlib.import_module("ai_models")
    _module = module
    return module


def default_artifact_dir() -> str:
    if settings.model_path:
        return str(Path(settings.model_path).expanduser().resolve().parent)
    return str(locate_ai_models_dir() / "artifacts")


def ai_submodule(name: str) -> ModuleType:
    package = load_ai_models()
    return importlib.import_module(f"{package.__name__}.{name}")
