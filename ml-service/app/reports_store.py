"""Read-only access to the verified Phase A/B result files in reports/.

Nothing is recalculated here: the API serves exactly what the committed,
tested reports contain.
"""

import csv
import json
import logging
from collections import defaultdict

from ml.categories import category_name

logger = logging.getLogger(__name__)

RANDOM_RUN = "svm_tfidf_v1"
TEMPORAL_RUN = "svm_tfidf_v1_temporal"
MODEL_NAMES = {"linear_svm": "TF-IDF + Linear SVM", "multinomial_nb": "TF-IDF + Naive Bayes",
               "majority_class": "Majority class"}

TRENDS_BASIS = (
    "Historical publication counts from the arXiv metadata snapshot (year of first submission, primary "
    "category). Descriptive only: this is not a forecast and not research-gap detection."
)
KEYWORDS_BASIS = (
    "Historically rising keywords: terms whose share of a category's papers grew most between the base "
    "and recent periods. This describes what was published; it is not a forecast and not research-gap detection."
)
FALLING_BASIS = (
    "Historically falling keywords: terms whose share of a category's papers fell most between the base "
    "and recent periods. This describes what was published; it is not a forecast."
)


def _json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def _csv(path):
    with path.open(encoding="utf-8", newline="") as source:
        return list(csv.DictReader(source))


class ReportsStore:
    def __init__(self, reports_dir):
        self.reports_dir = reports_dir
        self.metrics = {}
        self.trends = None
        self.errors = {}

    def load(self):
        try:
            run = self.reports_dir / RANDOM_RUN
            self.metrics = {
                "random": _json(run / "metrics.json"),
                "temporal": _json(self.reports_dir / TEMPORAL_RUN / "metrics.json"),
                "manifest": _json(run / "data_manifest.json"),
                "model_info": _json(run / "model_info.json"),
            }
        except (OSError, ValueError) as exc:
            logger.warning("Model evaluation reports unavailable: %s", exc)
            self.metrics = {}
            self.errors["metrics"] = "The model evaluation reports were not found."
        try:
            trends_dir = self.reports_dir / "trends"
            self.trends = {
                "summary": _json(trends_dir / "trends_summary.json"),
                "counts": _csv(trends_dir / "annual_counts.csv"),
                "rising": _csv(trends_dir / "rising_keywords.csv"),
                "falling": _csv(trends_dir / "falling_keywords.csv"),
                "series": _csv(trends_dir / "keyword_trends.csv"),
            }
        except (OSError, ValueError) as exc:
            logger.warning("Trend reports unavailable: %s", exc)
            self.trends = None
            self.errors["trends"] = "The trend reports were not found."
        return self

    @property
    def metrics_loaded(self):
        return bool(self.metrics)

    @property
    def trends_loaded(self):
        return self.trends is not None

    @property
    def categories(self):
        if self.trends_loaded:
            return list(self.trends["summary"]["parameters"]["categories"])
        return list(self.metrics["random"]["labels"]) if self.metrics_loaded else []

    # ------------------------------------------------------------ model evaluation

    def headline(self):
        """The two headline macro-F1 scores of the main model, for user-facing limitations."""
        if not self.metrics_loaded:
            return None
        return {split: self.metrics[split]["models"]["linear_svm"]["test"]["macro_f1"] for split in ("random", "temporal")}

    def model_metrics(self):
        info, manifest = self.metrics["model_info"], self.metrics["manifest"]
        evaluations = []
        for split, description in (
            ("random", "Stratified random 80/20 split: test papers come from the same years as training papers."),
            ("temporal", "Temporal split: trained on earlier papers, tested on later ones."),
        ):
            m = self.metrics[split]
            s = m["split"]
            evaluations.append({
                "name": split,
                "description": description,
                "trainSize": s["train_total"],
                "testSize": s["test_total"],
                "trainYears": s.get("train_years"),
                "testYears": s.get("test_years"),
                "models": [
                    {
                        "id": model_id,
                        "name": MODEL_NAMES[model_id],
                        "accuracy": r["test"]["accuracy"],
                        "macroPrecision": r["test"]["macro_precision"],
                        "macroRecall": r["test"]["macro_recall"],
                        "macroF1": r["test"]["macro_f1"],
                        "weightedF1": r["test"]["weighted_f1"],
                        "cvMacroF1Mean": r["cv_macro_f1_mean"],
                        "cvMacroF1Std": r["cv_macro_f1_std"],
                        "bestParams": r["best_params"],
                    }
                    for model_id, r in m["models"].items()
                ],
                "perCategory": [
                    {"category": c, "name": category_name(c), **v}
                    for c, v in m["models"]["linear_svm"]["test"]["per_class"].items()
                ],
                "svmVsNaiveBayes": {
                    "test": m["svm_vs_nb"]["test"],
                    "onlySvmCorrect": m["svm_vs_nb"]["only_svm_correct"],
                    "onlyNaiveBayesCorrect": m["svm_vs_nb"]["only_nb_correct"],
                    "pValue": m["svm_vs_nb"]["p_value"],
                    "significantAt005": m["svm_vs_nb"]["significant_at_0.05"],
                },
            })
        return {
            "modelVersion": info["run_name"],
            "trainedAt": info["created_at"],
            "algorithm": info["model"],
            "bestParams": info["best_params"],
            "categories": [{"code": c, "name": category_name(c)} for c in info["labels"]],
            "trainingData": {
                "source": "Cornell University arXiv metadata snapshot (Kaggle)",
                "datasetSha256": manifest["dataset"]["sha256"],
                "recordsRead": manifest["dataset"]["records_read"],
                "sampleSize": manifest["sample"]["total"],
                "perCategory": manifest["sample"]["by_category"],
                "years": manifest["parameters"]["years"],
                "labelPolicy": manifest["label_policy"],
            },
            "evaluations": evaluations,
        }

    # ------------------------------------------------------------ trends

    def trend_series(self, category=None):
        summary = self.trends["summary"]
        base = summary["parameters"]["index_base_year"]
        last = summary["dataset"]["last_full_year"]
        points = defaultdict(list)
        for row in self.trends["counts"]:
            if category and row["category"] != category:
                continue
            points[row["category"]].append({
                "year": int(row["year"]),
                "papers": int(row["papers_primary"]),
                "papersAnyListing": int(row["papers_any_listing"]),
                "csPapers": int(row["cs_primary_total"]),
                "shareOfCs": float(row["share_of_cs_primary"]),
                "incomplete": row["incomplete_year"] == "True",
            })
        codes = [category] if category else self.categories
        return {
            "basis": TRENDS_BASIS,
            "source": {
                "dataset": "Cornell University arXiv metadata snapshot (Kaggle)",
                "datasetSha256": summary["dataset"]["sha256"],
                "records": summary["dataset"]["records"],
                "latestSubmission": summary["dataset"]["latest_submission"],
                "lastFullYear": last,
            },
            "indexBaseYear": base,
            "categories": [
                {
                    "code": c,
                    "name": category_name(c),
                    "papersBaseYear": summary["categories"][c][f"papers_{base}"],
                    "papersLastFullYear": summary["categories"][c][f"papers_{last}"],
                    "growthMultiple": summary["categories"][c]["growth_multiple"],
                    "compoundAnnualGrowth": summary["categories"][c]["cagr"],
                    "shareOfCsBaseYear": summary["categories"][c][f"share_of_cs_{base}"],
                    "shareOfCsLastFullYear": summary["categories"][c][f"share_of_cs_{last}"],
                }
                for c in codes
            ],
            "series": [{"category": c, "name": category_name(c), "points": sorted(points[c], key=lambda p: p["year"])}
                       for c in codes],
            "limitations": summary["limitations"],
        }

    def keywords(self, category=None, direction="rising", limit=10):
        summary = self.trends["summary"]
        params = summary["parameters"]
        yearly = defaultdict(list)
        for row in self.trends["series"]:
            if row["direction"] == direction:
                yearly[(row["category"], row["term"])].append({
                    "year": int(row["year"]),
                    "papersWithTerm": int(row["papers_with_term"]),
                    "papers": int(row["papers"]),
                    "share": float(row["share"]),
                })
        grouped = defaultdict(list)
        for row in self.trends[direction]:
            if (category and row["category"] != category) or int(row["rank"]) > limit:
                continue
            grouped[row["category"]].append({
                "rank": int(row["rank"]),
                "term": row["term"],
                "label": row["display_label"],
                "baseShare": float(row["base_share"]),
                "recentShare": float(row["recent_share"]),
                "changePercentagePoints": float(row["change_pp"]),
                "growthScore": float(row["log_ratio"]),
                "similarTerms": [t for t in row["similar_terms_merged"].split("; ") if t],
                "yearly": sorted(yearly[(row["category"], row["term"])], key=lambda p: p["year"]),
            })
        codes = [category] if category else self.categories
        return {
            "basis": KEYWORDS_BASIS if direction == "rising" else FALLING_BASIS,
            "direction": direction,
            "measure": params["keyword_measure"],
            "basePeriod": params["keyword_base_years"],
            "recentPeriod": params["keyword_recent_years"],
            "minimumShare": params["min_share"],
            "growthScore": params["rising_score"],
            "categories": [{"code": c, "name": category_name(c), "keywords": sorted(grouped[c], key=lambda k: k["rank"])}
                           for c in codes],
        }
