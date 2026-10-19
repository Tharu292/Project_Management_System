"""Where the service finds its model and reports. Paths come from configuration only, never from a request."""

import os
from dataclasses import dataclass
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Settings:
    model_path: Path
    model_info_path: Path
    reports_dir: Path

    @classmethod
    def from_env(cls):
        model_path = Path(os.environ.get("ML_MODEL_PATH", SERVICE_ROOT / "models" / "svm_tfidf_v1.joblib"))
        info_path = Path(os.environ.get("ML_MODEL_INFO_PATH", model_path.with_name(f"{model_path.stem}_info.json")))
        reports_dir = Path(os.environ.get("ML_REPORTS_DIR", SERVICE_ROOT / "reports"))
        return cls(model_path=model_path, model_info_path=info_path, reports_dir=reports_dir)
