"""Tests of the research-opportunity analysis: engine, API and generated reports.

Engine and API tests that need the built index are skipped when models/opportunity
has not been generated. The example title and abstract are hand-written test
inputs; every paper the tests check comes from the real index.
"""

import csv
import json
import math
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.opportunity_store import REQUIRED_FILES

SERVICE = Path(__file__).resolve().parents[1]
REPORTS = SERVICE / "reports" / "opportunity"
REAL = Settings.from_env()
needs_index = pytest.mark.skipif(
    not all((REAL.opportunity_dir / f).is_file() for f in REQUIRED_FILES),
    reason="opportunity index not built; run ml.opportunity_corpus, ml.opportunity_retrieval, ml.opportunity_topics")

TITLE = "Language-guided grasp planning for household robots"
ABSTRACT = ("We study how large language models can translate natural-language instructions into grasp and motion "
            "plans for a mobile manipulator in household environments. The system grounds object references with a "
            "vision-language model, plans collision-free trajectories and is evaluated in simulation and on a real "
            "robot arm.")


@pytest.fixture(scope="module")
def engine():
    from ml.opportunity import OpportunityEngine
    return OpportunityEngine(REAL.opportunity_dir)


@pytest.fixture(scope="module")
def result(engine):
    return engine.analyse(TITLE, ABSTRACT)


@pytest.fixture(scope="module")
def client():
    return TestClient(create_app(REAL))


# ---------------------------------------------------------------- engine

def test_percentile_ranks():
    from ml.opportunity import percentile
    assert list(percentile([3, 1, 2])) == [1.0, 0.0, 0.5]
    assert list(percentile([7])) == [1.0]


@needs_index
def test_similar_papers_are_real_indexed_papers(engine, result):
    ids = set(engine.ids.tolist())
    papers = result["similarPapers"]
    assert len(papers) == 10 and [p["rank"] for p in papers] == list(range(1, 11))
    sims = [p["similarity"] for p in papers]
    assert sims == sorted(sims, reverse=True) and 0 < sims[-1] <= sims[0] <= 1
    for p in papers:
        assert p["arxivId"] in ids
        assert p["url"] == f"https://arxiv.org/abs/{p['arxivId']}"
        assert p["title"] == str(engine.titles[engine.ids == p["arxivId"]][0])


@needs_index
def test_directions_follow_the_documented_score(engine, result):
    from ml.opportunity import MIN_RECENT_PAPERS, WEIGHTS
    directions = result["directions"]
    assert 3 <= len(directions) <= 5
    assert [d["rank"] for d in directions] == list(range(1, len(directions) + 1))
    assert [d["score"] for d in directions] == sorted((d["score"] for d in directions), reverse=True)
    for d in directions:
        assert all(0 <= v <= 1 for v in d["factors"].values())
        assert d["score"] == pytest.approx(sum(WEIGHTS[k] * d["factors"][k] for k in WEIGHTS), abs=1e-3)
        assert d["evidence"]["recentPapers"] >= MIN_RECENT_PAPERS
        assert d["supportingPapers"], "every direction must show real supporting papers"


@needs_index
def test_evidence_counts_and_supporting_papers_are_consistent(engine, result):
    tau = engine.tau
    recent_counts, recent_total = engine.window_counts["recent"]
    old_counts, old_total = engine.window_counts["old"]
    for d in result["directions"]:
        a, b = (t["topicId"] for t in d["topics"])
        assert d["evidence"]["recentPapers"] == int(recent_counts[a, b])
        assert d["evidence"]["olderPapers"] == int(old_counts[a, b])
        for p in d["supportingPapers"]:
            i = int(np.where(engine.ids == p["arxivId"])[0][0])
            assert engine.shares[i, a] >= tau and engine.shares[i, b] >= tau
        # Recomputed from the exact counts (the shares in the response are rounded for display).
        growth = math.log((recent_counts[a, b] / recent_total + 1e-4) / (old_counts[a, b] / old_total + 1e-4))
        assert d["evidence"]["growthLogRatio"] == pytest.approx(growth, abs=1e-3)


@needs_index
def test_excluded_paper_never_appears_as_its_own_evidence(engine, result):
    target = result["similarPapers"][0]["arxivId"]
    again = engine.analyse(TITLE, ABSTRACT, exclude_id=target)
    assert target not in [p["arxivId"] for p in again["similarPapers"]]
    assert all(target not in [p["arxivId"] for p in d["supportingPapers"]] for d in again["directions"])


@needs_index
def test_coverage_notes_distinguish_dataset_coverage(engine):
    base = {"recent": 50, "recentShare": 0.0005, "controlRecent": 40, "controlShare": 0.002}
    assert engine._coverage_note(base)[0] == "dataset_coverage"
    assert engine._coverage_note({**base, "controlRecent": 3})[0] != "dataset_coverage"
    assert engine._coverage_note({**base, "recent": 8, "controlShare": 0.0})[0] == "limited_evidence"


@needs_index
def test_wording_never_claims_novelty(result):
    text = json.dumps(result).lower()
    for forbidden in ("unexplored topic", "completely new", "novel direction", "guaranteed", "confidence"):
        assert forbidden not in text
    assert any("not proof of a research gap" in item for item in result["limitations"])


# ---------------------------------------------------------------- API

@needs_index
def test_api_returns_classification_papers_topics_and_directions(client):
    response = client.post("/api/v1/opportunities", json={"title": TITLE, "abstract": ABSTRACT})
    assert response.status_code == 200
    body = response.json()
    assert body["classification"]["category"] == "cs.RO"
    assert "decisionScore" not in json.dumps(body["classification"])
    assert len(body["similarPapers"]) == 10 and 3 <= len(body["directions"]) <= 5
    assert "not proof of a research gap" in body["basis"]
    assert client.get("/health").json()["opportunityAnalysisLoaded"] is True


def test_api_rejects_invalid_input(client):
    response = client.post("/api/v1/opportunities", json={"title": TITLE, "abstract": "too short"})
    assert response.status_code == 400 and "abstract" in response.json()["fieldErrors"]


@needs_index
def test_api_rejects_text_the_index_cannot_read(client):
    gibberish = " ".join(f"zzqx{i}" for i in range(40))
    response = client.post("/api/v1/opportunities", json={"title": "qwrt zxcv", "abstract": gibberish})
    assert response.status_code == 400 and "too few terms" in response.json()["fieldErrors"]["abstract"]


def test_missing_index_is_a_503(tmp_path):
    client = TestClient(create_app(Settings(model_path=REAL.model_path, model_info_path=REAL.model_info_path,
                                            reports_dir=REAL.reports_dir, opportunity_dir=tmp_path)))
    assert client.get("/health").json()["opportunityAnalysisAvailable"] is False
    response = client.post("/api/v1/opportunities", json={"title": TITLE, "abstract": ABSTRACT})
    assert response.status_code == 503 and "not available" in response.json()["message"]


def test_evaluation_endpoint_serves_the_reports(client):
    body = client.get("/api/v1/opportunities/evaluation").json()
    assert body["retrieval"]["known_item_search"]["recall_at_10"] == json.loads(
        (REPORTS / "retrieval_metrics.json").read_text())["known_item_search"]["recall_at_10"]
    assert body["topicModel"]["chosenK"] == len(body["topicModel"]["topics"])
    assert body["recommendations"]["expert_review"]["done"] is False


# ---------------------------------------------------------------- generated reports

def test_retrieval_report_is_consistent():
    m = json.loads((REPORTS / "retrieval_metrics.json").read_text())["known_item_search"]
    assert 0 <= m["recall_at_1"] <= m["recall_at_5"] <= m["recall_at_10"] <= 1
    assert m["recall_at_1"] <= m["mrr"] <= 1


def test_chosen_topic_count_has_the_best_held_out_coherence():
    report = json.loads((REPORTS / "topic_model.json").read_text())
    best = max(report["selection"], key=lambda s: (s["mean_npmi"], -s["k"]))
    assert report["chosen_k"] == best["k"] == len(report["topics"])
    assert all(len(t["representative_papers"]) == 5 for t in report["topics"])


def test_recommendation_report_states_accuracy_is_not_measured():
    report = json.loads((REPORTS / "recommendation_evaluation.json").read_text())
    assert "NOT measured" in report["status"]
    assert 0 <= report["groundedness_share_with_3plus_supporting_papers"] <= 1
    with (REPORTS / "expert_review_sheet.csv").open(encoding="utf-8") as source:
        header = next(csv.reader(source))
    assert {"relevance_1to5", "plausibly_less_studied_yes_no_unsure", "reviewer"} <= set(header)
