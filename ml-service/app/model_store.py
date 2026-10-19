"""Loads the trained TF-IDF + Linear SVM pipeline once and classifies texts with it."""

import json
import logging

import joblib

from ml.text_utils import build_text

logger = logging.getLogger(__name__)

# A text must share at least this many terms (words or word pairs) with the model's
# vocabulary. This only rejects input the model cannot read at all; it is not a test
# of whether the text belongs to one of the five categories.
MIN_RECOGNISED_TERMS = 5


class ModelStore:
    """The model is loaded from a trusted, configured path. A missing or broken file
    leaves the store unloaded, with a reason, instead of stopping the service."""

    def __init__(self, model_path, info_path):
        self.model_path = model_path
        self.info_path = info_path
        self.pipeline = None
        self.info = {}
        self.error = None

    def load(self):
        try:
            if not self.model_path.is_file():
                raise FileNotFoundError(
                    f"Model file '{self.model_path.name}' was not found. Train it with "
                    "`python -m ml.train_classifier` (see docs/dataset.md)."
                )
            pipeline = joblib.load(self.model_path)
            if not hasattr(pipeline, "named_steps") or {"tfidf", "clf"} - set(pipeline.named_steps):
                raise ValueError(f"'{self.model_path.name}' is not a TF-IDF + classifier pipeline.")
            self.info = json.loads(self.info_path.read_text(encoding="utf-8")) if self.info_path.is_file() else {}
            self.pipeline = pipeline
            self.error = None
        except FileNotFoundError as exc:
            self.error = str(exc)
        except Exception as exc:  # a corrupt or incompatible file
            logger.exception("Could not load the model")
            self.error = f"Model file '{self.model_path.name}' could not be loaded ({type(exc).__name__})."
        return self

    @property
    def loaded(self):
        return self.pipeline is not None

    @property
    def version(self):
        return self.info.get("run_name") or self.model_path.stem

    @property
    def labels(self):
        return [str(c) for c in self.pipeline.named_steps["clf"].classes_] if self.loaded else []

    def classify(self, title, abstract):
        """Returns (ranking, recognised_terms); ranking is [(category, decision score)], best first."""
        features = self.pipeline.named_steps["tfidf"].transform([build_text(title, abstract)])
        recognised = int(features.nnz)
        scores = self.pipeline.named_steps["clf"].decision_function(features)[0]
        ranking = sorted(zip(self.labels, (float(s) for s in scores)), key=lambda pair: -pair[1])
        return ranking, recognised
