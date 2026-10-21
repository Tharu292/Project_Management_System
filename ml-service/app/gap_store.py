"""Lazy, thread-safe access to the aspect-level gap analyser.

It reuses the opportunity engine already held by the OpportunityStore (the same
retrieval index and topic model, loaded once) and adds the abstract-level
evidence store from models/gap. Missing artefacts make only this feature
unavailable (503).
"""

import logging
import threading

logger = logging.getLogger(__name__)

GAP_FILES = ("evidence.joblib",)
GAP_BUILD_HINT = "Build it with `python -m ml.gap_evidence` (see docs/gap_analysis.md)."


class GapStore:
    def __init__(self, directory, opportunity_store):
        self.directory = directory
        self.opportunity = opportunity_store
        self._analyser = None
        self._lock = threading.Lock()
        self.error = None

    @property
    def available(self):
        return (self.error is None and self.opportunity.available
                and all((self.directory / name).is_file() for name in GAP_FILES))

    @property
    def loaded(self):
        return self._analyser is not None

    def analyser(self):
        if self._analyser is not None:
            return self._analyser
        if not self.available:
            return None
        engine = self.opportunity.engine()
        if engine is None:
            return None
        with self._lock:
            if self._analyser is None and self.error is None:
                try:
                    from ml.gap_analysis import GapAnalyzer

                    self._analyser = GapAnalyzer(engine, self.directory)
                except Exception as exc:
                    logger.exception("Could not load the gap evidence store")
                    self.error = f"The gap evidence store could not be loaded ({type(exc).__name__})."
        return self._analyser
