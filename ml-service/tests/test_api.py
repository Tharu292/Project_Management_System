"""Tests of the FastAPI service: model loading, prediction, input validation, trends and errors.

Tests that need the trained model are skipped when models/ has not been generated
(the model is not in Git). Broken and missing model files are simulated with
temporary files, so those tests always run. The example title and abstract are
hand-written test inputs, not research data.
"""

import csv
import json
from pathlib import Path

import joblib
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

SERVICE = Path(__file__).resolve().parents[1]
REPORTS = SERVICE / "reports"
REAL = Settings.from_env()
needs_model = pytest.mark.skipif(not REAL.model_path.is_file(),
                                 reason="trained model not present; run `python -m ml.train_classifier`")

TITLE = "Footstep planning for legged robots on uneven terrain"
ABSTRACT = ("We present a model predictive control approach that allows a quadruped robot to plan footsteps and "
            "avoid obstacles using onboard lidar and proprioception. The controller is validated in simulation and "
            "in hardware experiments on a legged platform walking over rough terrain.")
ERROR_KEYS = {"timestamp", "status", "error", "message", "path", "fieldErrors"}


def client_for(**overrides):
    settings = Settings(**{"model_path": REAL.model_path, "model_info_path": REAL.model_info_path,
                           "reports_dir": REAL.reports_dir, **overrides})
    return TestClient(create_app(settings))


@pytest.fixture(scope="module")
def client():
    return client_for()


@pytest.fixture(scope="module")
def no_model_client(tmp_path_factory):
    missing = tmp_path_factory.mktemp("models") / "absent.joblib"
    return client_for(model_path=missing, model_info_path=missing.with_suffix(".json"))


def read_csv(path):
    with path.open(encoding="utf-8", newline="") as source:
        return list(csv.DictReader(source))


def assert_api_error(response, status):
    assert response.status_code == status
    body = response.json()
    assert set(body) == ERROR_KEYS and body["status"] == status
    return body


# ---------------------------------------------------------------- model loading and health

@needs_model
def test_health_reports_loaded_model_matching_the_reports(client):
    body = client.get("/health").json()
    assert body["status"] == "healthy" and body["modelLoaded"] and body["modelError"] is None
    assert body["modelVersion"] == "svm_tfidf_v1"
    assert body["modelMatchesReports"] is True


@needs_model
def test_model_knows_the_five_report_categories(client):
    model = client.app.state.model
    assert model.labels == load_metrics("svm_tfidf_v1")["labels"]


def test_missing_model_degrades_instead_of_crashing(no_model_client):
    health = no_model_client.get("/health").json()
    assert health["status"] == "degraded" and health["modelLoaded"] is False
    assert "was not found" in health["modelError"]
    body = assert_api_error(no_model_client.post("/api/v1/predict", json={"title": TITLE, "abstract": ABSTRACT}), 503)
    assert "not available" in body["message"]
    # The verified reports are still served without the model binary.
    assert no_model_client.get("/api/v1/trends").status_code == 200
    assert no_model_client.get("/api/v1/model/metrics").json()["modelLoaded"] is False


@pytest.mark.parametrize("content", [b"not a pickle at all", None])
def test_corrupt_or_wrong_model_file_is_rejected(tmp_path, content):
    path = tmp_path / "broken.joblib"
    if content is None:
        joblib.dump({"not": "a pipeline"}, path)
    else:
        path.write_bytes(content)
    client = client_for(model_path=path, model_info_path=tmp_path / "info.json")
    health = client.get("/health").json()
    assert health["modelLoaded"] is False and "broken.joblib" in health["modelError"]
    assert str(tmp_path) not in health["modelError"]  # no local paths leak
    assert_api_error(client.post("/api/v1/predict", json={"title": TITLE, "abstract": ABSTRACT}), 503)


# ---------------------------------------------------------------- prediction

@needs_model
def test_predict_returns_category_ranking_and_limitations(client):
    response = client.post("/api/v1/predict", json={"title": TITLE, "abstract": ABSTRACT})
    assert response.status_code == 200
    body = response.json()
    assert body["category"] == "cs.RO" and body["categoryName"] == "Robotics"
    assert body["modelVersion"] == "svm_tfidf_v1"
    ranking = body["ranking"]
    assert [r["rank"] for r in ranking] == [1, 2, 3, 4, 5] and ranking[0]["category"] == body["category"]
    scores = [r["decisionScore"] for r in ranking]
    assert scores == sorted(scores, reverse=True)
    assert "not probabilities" in body["scoreNote"]
    assert any("no 'other' category" in item for item in body["limitations"])
    assert any("research gaps" in item for item in body["limitations"])


@needs_model
def test_predict_never_reports_probabilities_or_percentages(client):
    body = client.post("/api/v1/predict", json={"title": TITLE, "abstract": ABSTRACT}).json()
    keys = json.dumps(list(body) + [k for r in body["ranking"] for k in r]).lower()
    assert "prob" not in keys and "confidence" not in keys
    assert "%" not in json.dumps(body)


@needs_model
def test_predict_scores_equal_the_saved_pipeline(client):
    from ml.text_utils import build_text
    pipeline = joblib.load(REAL.model_path)
    expected = dict(zip(pipeline.classes_, pipeline.decision_function([build_text(TITLE, ABSTRACT)])[0]))
    body = client.post("/api/v1/predict", json={"title": TITLE, "abstract": ABSTRACT}).json()
    for r in body["ranking"]:
        assert r["decisionScore"] == pytest.approx(expected[r["category"]], abs=1e-4)


@needs_model
def test_predict_ignores_unknown_fields(client):
    response = client.post("/api/v1/predict", json={"title": TITLE, "abstract": ABSTRACT, "extra": 1})
    assert response.status_code == 200


@needs_model
@pytest.mark.parametrize("payload, field, fragment", [
    ({"title": " ", "abstract": ABSTRACT}, "title", "at least 3 characters"),
    ({"title": "x" * 301, "abstract": ABSTRACT}, "title", "at most 300"),
    ({"title": TITLE, "abstract": ""}, "abstract", "Enter the abstract"),
    ({"title": TITLE, "abstract": "far too short"}, "abstract", "at least 30 words (it has 3)"),
    ({"title": TITLE, "abstract": "word " * 1001}, "abstract", "at most 1,000 words"),
    ({"title": TITLE, "abstract": "a" * 10_001}, "abstract", "at most 10,000 characters"),
    ({"title": TITLE}, "abstract", "required"),
    ({"abstract": ABSTRACT}, "title", "required"),
    ({"title": 5, "abstract": ABSTRACT}, "title", "Must be text"),
    ({"title": TITLE, "abstract": ["a", "list"]}, "abstract", "Must be text"),
])
def test_predict_rejects_invalid_fields(client, payload, field, fragment):
    body = assert_api_error(client.post("/api/v1/predict", json=payload), 400)
    assert fragment in body["fieldErrors"][field]


@needs_model
@pytest.mark.parametrize("kwargs, message", [
    ({"content": b"{not json", "headers": {"Content-Type": "application/json"}}, "not valid JSON"),
    ({}, "JSON body with 'title' and 'abstract' is required"),
    ({"content": b"title=x", "headers": {"Content-Type": "text/plain"}}, "JSON body"),
])
def test_predict_rejects_malformed_requests(client, kwargs, message):
    body = assert_api_error(client.post("/api/v1/predict", **kwargs), 400)
    assert message in body["message"]


@needs_model
def test_predict_rejects_text_the_model_cannot_read(client):
    gibberish = " ".join(f"zzqx{i}" for i in range(40))
    body = assert_api_error(client.post("/api/v1/predict", json={"title": "qwrt zxcv", "abstract": gibberish}), 400)
    assert "too few terms the model recognises" in body["fieldErrors"]["abstract"]


# ---------------------------------------------------------------- model metrics

def load_metrics(run):
    return json.loads((REPORTS / run / "metrics.json").read_text(encoding="utf-8"))


def test_model_metrics_are_served_from_the_reports(client):
    body = client.get("/api/v1/model/metrics").json()
    assert body["modelVersion"] == "svm_tfidf_v1"
    for evaluation in body["evaluations"]:
        run = {"random": "svm_tfidf_v1", "temporal": "svm_tfidf_v1_temporal"}[evaluation["name"]]
        source = load_metrics(run)
        svm = next(m for m in evaluation["models"] if m["id"] == "linear_svm")
        assert svm["macroF1"] == source["models"]["linear_svm"]["test"]["macro_f1"]
        assert evaluation["svmVsNaiveBayes"]["pValue"] == source["svm_vs_nb"]["p_value"]
        assert evaluation["testSize"] == source["split"]["test_total"]


# ---------------------------------------------------------------- trends

def test_trends_match_the_verified_counts(client):
    body = client.get("/api/v1/trends").json()
    assert "not a forecast" in body["basis"] and "not research-gap detection" in body["basis"]
    rows = {(int(r["year"]), r["category"]): r for r in read_csv(REPORTS / "trends" / "annual_counts.csv")}
    assert {s["category"] for s in body["series"]} == {"cs.CV", "cs.CL", "cs.CR", "cs.RO", "cs.DB"}
    last_full = body["source"]["lastFullYear"]
    for series in body["series"]:
        for point in series["points"]:
            row = rows[(point["year"], series["category"])]
            assert point["papers"] == int(row["papers_primary"])
            assert point["csPapers"] == int(row["cs_primary_total"])
            assert point["incomplete"] == (point["year"] > last_full)


def test_trends_filter_and_unknown_category(client):
    body = client.get("/api/v1/trends", params={"category": "cs.DB"}).json()
    assert [s["category"] for s in body["series"]] == ["cs.DB"] and body["categories"][0]["name"] == "Databases"
    error = assert_api_error(client.get("/api/v1/trends", params={"category": "cs.LG"}), 400)
    assert "Unknown category 'cs.LG'" in error["fieldErrors"]["category"]


def test_emerging_topics_are_historical_and_match_the_csv(client):
    body = client.get("/api/v1/emerging-topics").json()
    assert body["direction"] == "rising" and "not a forecast" in body["basis"]
    assert body["basePeriod"] == [2018, 2019] and body["recentPeriod"] == [2024, 2025]
    csv_rows = {(r["category"], r["term"]): r for r in read_csv(REPORTS / "trends" / "rising_keywords.csv")}
    for category in body["categories"]:
        ranks = [k["rank"] for k in category["keywords"]]
        assert ranks == sorted(ranks) and len(ranks) == 10
        for keyword in category["keywords"]:
            row = csv_rows[(category["code"], keyword["term"])]
            assert keyword["recentShare"] == float(row["recent_share"])
            assert keyword["label"] == row["display_label"]
            assert [p["year"] for p in keyword["yearly"]] == list(range(2015, 2026))


def test_emerging_topics_parameters(client):
    body = client.get("/api/v1/emerging-topics", params={"category": "cs.CL", "limit": 3}).json()
    assert [c["code"] for c in body["categories"]] == ["cs.CL"] and len(body["categories"][0]["keywords"]) == 3
    falling = client.get("/api/v1/emerging-topics", params={"direction": "falling"}).json()
    assert falling["direction"] == "falling" and all(
        k["changePercentagePoints"] < 0 for c in falling["categories"] for k in c["keywords"])
    for params, field in [({"limit": 0}, "limit"), ({"limit": 11}, "limit"), ({"limit": "x"}, "limit"),
                          ({"direction": "up"}, "direction"), ({"category": "cs.XX"}, "category")]:
        assert field in assert_api_error(client.get("/api/v1/emerging-topics", params=params), 400)["fieldErrors"]


def test_missing_reports_return_503(tmp_path):
    client = client_for(reports_dir=tmp_path)
    for path in ("/api/v1/trends", "/api/v1/emerging-topics", "/api/v1/model/metrics"):
        assert_api_error(client.get(path), 503)
    assert client.get("/health").json()["trendsLoaded"] is False


# ---------------------------------------------------------------- generic errors

def test_unknown_route_and_wrong_method_use_the_error_shape(client):
    assert assert_api_error(client.get("/api/v1/does-not-exist"), 404)["message"] == "Not found."
    assert_api_error(client.get("/api/v1/predict"), 405)
