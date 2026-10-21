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
    opportunity_dir: Path = SERVICE_ROOT / "models" / "opportunity"
    gap_dir: Path = SERVICE_ROOT / "models" / "gap"

    @classmethod
    def from_env(cls):
        model_path = Path(os.environ.get("ML_MODEL_PATH", SERVICE_ROOT / "models" / "svm_tfidf_v1.joblib"))
        info_path = Path(os.environ.get("ML_MODEL_INFO_PATH", model_path.with_name(f"{model_path.stem}_info.json")))
        reports_dir = Path(os.environ.get("ML_REPORTS_DIR", SERVICE_ROOT / "reports"))
        opportunity_dir = Path(os.environ.get("ML_OPPORTUNITY_DIR", SERVICE_ROOT / "models" / "opportunity"))
        gap_dir = Path(os.environ.get("ML_GAP_DIR", SERVICE_ROOT / "models" / "gap"))
        return cls(model_path=model_path, model_info_path=info_path, reports_dir=reports_dir,
                   opportunity_dir=opportunity_dir, gap_dir=gap_dir)
