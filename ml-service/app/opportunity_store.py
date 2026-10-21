"""Lazy, thread-safe access to the research-opportunity engine (retrieval index + topic model).

The artefacts are large (about 450 MB), so they are loaded on the first request
that needs them, not at start-up. Missing or broken artefacts make the feature
unavailable (503) without affecting the rest of the service.
"""

import logging
import threading

logger = logging.getLogger(__name__)

REQUIRED_FILES = ("retrieval_vectorizer.joblib", "retrieval_matrix.npz", "corpus_meta.joblib", "topics.joblib")
BUILD_HINT = ("Build it with `python -m ml.opportunity_corpus`, `python -m ml.opportunity_retrieval` and "
              "`python -m ml.opportunity_topics` (see docs/opportunities.md).")


class OpportunityStore:
    def __init__(self, directory):
        self.directory = directory
        self._engine = None
        self._lock = threading.Lock()
        self.error = None

    @property
    def available(self):
        return self.error is None and all((self.directory / name).is_file() for name in REQUIRED_FILES)

    @property
    def loaded(self):
        return self._engine is not None

    def engine(self):
        """The loaded engine, or None when the artefacts are missing or could not be loaded."""
        if self._engine is not None:
            return self._engine
        if not self.available:
            return None
        with self._lock:
            if self._engine is None and self.error is None:
                try:
                    from ml.opportunity import OpportunityEngine

                    self._engine = OpportunityEngine(self.directory)
                except Exception as exc:  # corrupt or inconsistent artefacts
                    logger.exception("Could not load the opportunity engine")
                    self.error = f"The research opportunity index could not be loaded ({type(exc).__name__})."
        return self._engine
