"""Consistency checks of the committed, generated reports.

These tests read only files in reports/. They recompute the reported metrics
from the confusion matrices, re-derive the McNemar p-values from the stored
counts, and check the model card and the trend tables against the files they
were generated from. They catch a report edited by hand or left stale.
"""

import csv
import json
import math
import re
from pathlib import Path

import pytest
from scipy.stats import binomtest

REPORTS = Path(__file__).resolve().parents[1] / "reports"
RUNS = ["svm_tfidf_v1", "svm_tfidf_v1_temporal"]


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def read_csv(path):
    with path.open(encoding="utf-8", newline="") as source:
        return list(csv.DictReader(source))


def confusion(run):
    with (REPORTS / run / "confusion_matrix.csv").open(encoding="utf-8", newline="") as source:
        rows = list(csv.reader(source))
    labels = rows[0][1:]
    matrix = {row[0]: dict(zip(labels, map(int, row[1:]))) for row in rows[1:]}
    return labels, matrix


# ---------------------------------------------------------------- classifier reports

@pytest.mark.parametrize("run", RUNS)
def test_svm_metrics_match_confusion_matrix(run):
    metrics = load_json(REPORTS / run / "metrics.json")
    svm = metrics["models"]["linear_svm"]["test"]
    labels, cm = confusion(run)
    total = sum(sum(row.values()) for row in cm.values())
    assert total == metrics["split"]["test_total"]
    assert sum(cm[c][c] for c in labels) / total == pytest.approx(svm["accuracy"], abs=1e-4)
    f1s = []
    for c in labels:
        tp = cm[c][c]
        precision = tp / sum(cm[t][c] for t in labels)
        recall = tp / sum(cm[c].values())
        f1 = 2 * precision * recall / (precision + recall)
        f1s.append(f1)
        assert svm["per_class"][c]["precision"] == pytest.approx(precision, abs=1e-4)
        assert svm["per_class"][c]["recall"] == pytest.approx(recall, abs=1e-4)
        assert svm["per_class"][c]["f1"] == pytest.approx(f1, abs=1e-4)
        assert svm["per_class"][c]["support"] == sum(cm[c].values())
    assert svm["macro_f1"] == pytest.approx(sum(f1s) / len(f1s), abs=1e-4)


@pytest.mark.parametrize("run", RUNS)
def test_error_list_and_test_ids_match(run):
    metrics = load_json(REPORTS / run / "metrics.json")
    labels, cm = confusion(run)
    errors = sum(cm[t][p] for t in labels for p in labels if t != p)
    assert len(read_csv(REPORTS / run / "misclassified_test.csv")) == errors
    ids = (REPORTS / run / "test_ids.txt").read_text(encoding="utf-8").split()
    assert len(ids) == len(set(ids)) == metrics["split"]["test_total"]


@pytest.mark.parametrize("run", RUNS)
def test_no_leakage_recorded(run):
    split = load_json(REPORTS / run / "split.json")
    assert split["leakage_checks"] == {"shared_ids": 0, "test_titles_seen_in_train": 0}
    assert set(split["test_by_category"].values()) == {400}
    assert set(split["train_by_category"].values()) == {1600}


@pytest.mark.parametrize("run", RUNS)
def test_mcnemar_p_value_rederived_from_counts(run):
    result = load_json(REPORTS / run / "metrics.json")["svm_vs_nb"]
    n = result["only_svm_correct"] + result["only_nb_correct"]
    assert result["p_value"] == pytest.approx(binomtest(result["only_svm_correct"], n, 0.5).pvalue, rel=1e-9)
    assert result["significant_at_0.05"] == (result["p_value"] < 0.05)


@pytest.mark.parametrize("run", RUNS)
def test_baseline_csv_matches_metrics(run):
    metrics = load_json(REPORTS / run / "metrics.json")["models"]
    for row in read_csv(REPORTS / run / "baseline_comparison.csv"):
        test = metrics[row["model"]]["test"]
        assert float(row["test_macro_f1"]) == test["macro_f1"]
        assert float(row["test_accuracy"]) == test["accuracy"]


def test_temporal_split_years_are_disjoint_and_complete():
    split = load_json(REPORTS / "svm_tfidf_v1_temporal" / "metrics.json")["split"]
    assert split["train_years"][1] < split["test_years"][0]
    years = [int(y) for y in split["test_by_year"]]
    assert min(years) >= split["test_years"][0] and max(years) <= split["test_years"][1]
    assert sum(split["test_by_year"].values()) == split["test_total"]


def test_majority_baseline_is_chance_level():
    for run in RUNS:
        test = load_json(REPORTS / run / "metrics.json")["models"]["majority_class"]["test"]
        assert test["accuracy"] == pytest.approx(0.2)


# ---------------------------------------------------------------- model card

def test_model_card_results_table_matches_metrics():
    card = (REPORTS / "MODEL_CARD.md").read_text(encoding="utf-8")
    names = {"TF-IDF + Linear SVM": "linear_svm", "TF-IDF + Naive Bayes": "multinomial_nb",
             "Majority class": "majority_class"}
    runs = {"random": "svm_tfidf_v1", "temporal": "svm_tfidf_v1_temporal"}
    rows = re.findall(r"^\| (TF-IDF \+ Linear SVM|TF-IDF \+ Naive Bayes|Majority class) \| (random|temporal) \| "
                      r"([\d.]+) \| ([\d.]+) \| ([\d.]+) \| ([\d.]+) \|", card, flags=re.M)
    assert len(rows) == 6
    for name, split, acc, prec, rec, f1 in rows:
        test = load_json(REPORTS / runs[split] / "metrics.json")["models"][names[name]]["test"]
        assert (float(acc), float(prec), float(rec), float(f1)) == pytest.approx(
            (test["accuracy"], test["macro_precision"], test["macro_recall"], test["macro_f1"]), abs=5e-5)


def test_model_card_significance_wording_matches_tests():
    card = (REPORTS / "MODEL_CARD.md").read_text(encoding="utf-8")
    for run, split in (("svm_tfidf_v1", "Random"), ("svm_tfidf_v1_temporal", "Temporal")):
        result = load_json(REPORTS / run / "metrics.json")["svm_vs_nb"]
        line = next(l for l in card.splitlines() if l.startswith(f"- **{split} split:**"))
        assert ("**not** statistically significant" in line) == (not result["significant_at_0.05"])
        assert f"{result['only_svm_correct']} were classified correctly only by the SVM" in line


# ---------------------------------------------------------------- trends

@pytest.fixture(scope="module")
def trends():
    return load_json(REPORTS / "trends" / "trends_summary.json")


def test_year_boundaries(trends):
    latest = trends["dataset"]["latest_submission"]
    last_full = trends["dataset"]["last_full_year"]
    assert last_full == int(latest[:4]) - (0 if latest.endswith("12-31") else 1)
    params = trends["parameters"]
    assert params["keyword_recent_years"] == [last_full - 1, last_full]
    assert params["keyword_base_years"][-1] < params["keyword_recent_years"][0]
    for row in read_csv(REPORTS / "trends" / "annual_counts.csv"):
        assert (row["incomplete_year"] == "True") == (int(row["year"]) > last_full)


def test_counts_shares_and_growth(trends):
    rows = read_csv(REPORTS / "trends" / "annual_counts.csv")
    index = {(int(r["year"]), r["category"]): r for r in rows}
    for r in rows:
        papers, cs_total = int(r["papers_primary"]), int(r["cs_primary_total"])
        assert papers <= int(r["papers_any_listing"]) and papers <= cs_total <= int(r["arxiv_total"])
        assert float(r["share_of_cs_primary"]) == pytest.approx(papers / cs_total, abs=1e-5)
    base, last = trends["parameters"]["index_base_year"], trends["dataset"]["last_full_year"]
    for c, s in trends["categories"].items():
        first, final = int(index[(base, c)]["papers_primary"]), int(index[(last, c)]["papers_primary"])
        assert (s[f"papers_{base}"], s[f"papers_{last}"]) == (first, final)
        assert s["growth_multiple"] == pytest.approx(final / first, abs=1e-3)
        assert s["cagr"] == pytest.approx((final / first) ** (1 / (last - base)) - 1, abs=1e-4)


@pytest.mark.parametrize("direction", ["rising", "falling"])
def test_keyword_rankings(trends, direction):
    min_share = trends["parameters"]["min_share"]
    rows = read_csv(REPORTS / "trends" / f"{direction}_keywords.csv")
    by_category = {}
    for r in rows:
        by_category.setdefault(r["category"], []).append(r)
        base, recent, score = float(r["base_share"]), float(r["recent_share"]), float(r["log_ratio"])
        assert score == pytest.approx(math.log((recent + 0.002) / (base + 0.002)), abs=2e-3)
        assert float(r["change_pp"]) == pytest.approx((recent - base) * 100, abs=2e-2)
        if direction == "rising":
            assert score > 0 and recent >= min_share
        else:
            assert score < 0 and base >= min_share
    for category, ranked in by_category.items():
        scores = [float(r["log_ratio"]) for r in ranked]
        assert scores == sorted(scores, reverse=(direction == "rising")), category
        assert [int(r["rank"]) for r in ranked] == list(range(1, len(ranked) + 1))


def test_keyword_series_match_shares_and_periods(trends):
    params = trends["parameters"]
    rows = read_csv(REPORTS / "trends" / "keyword_trends.csv")
    series = {}
    for r in rows:
        assert float(r["share"]) == pytest.approx(int(r["papers_with_term"]) / int(r["papers"]), abs=1e-5)
        series.setdefault((r["category"], r["term"]), {})[int(r["year"])] = float(r["share"])
    for direction in ("rising", "falling"):
        for r in read_csv(REPORTS / "trends" / f"{direction}_keywords.csv"):
            years = series[(r["category"], r["term"])]
            assert max(years) == trends["dataset"]["last_full_year"]
            mean = lambda period: sum(years[y] for y in period) / len(period)  # noqa: E731
            assert mean(params["keyword_base_years"]) == pytest.approx(float(r["base_share"]), abs=1e-4)
            assert mean(params["keyword_recent_years"]) == pytest.approx(float(r["recent_share"]), abs=1e-4)


def test_all_presentation_figures_exist():
    names = ["01_papers_per_year", "02_growth_index", "03_share_of_cs", "04_rising_keywords",
             "05_model_comparison", "06_per_category_f1"]
    for name in names:
        assert (REPORTS / "figures" / f"{name}.png").stat().st_size > 10_000
