"""Trains and evaluates the TF-IDF + Linear SVM research topic classifier.

Protocol (see docs/dataset.md):
  1. Stratified 80/20 train/test split with a fixed seed, made BEFORE any fitting.
  2. Hyperparameters are chosen by 5-fold stratified cross-validation on the
     training set only (macro-F1). TF-IDF is inside the pipeline, so its
     vocabulary and IDF weights are learned from training folds only.
  3. The chosen model is refitted on the whole training set and scored once on
     the untouched test set.
  4. Two baselines go through exactly the same protocol: majority class and
     TF-IDF + Multinomial Naive Bayes. Their results are reported as they are.

Usage:
  python -m ml.train_classifier --data data/processed/sample.jsonl.gz
"""

import argparse
import csv
import gzip
import json
import platform
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import sklearn  # noqa: E402
from sklearn.dummy import DummyClassifier  # noqa: E402
from sklearn.feature_extraction.text import TfidfVectorizer  # noqa: E402
from sklearn.metrics import (  # noqa: E402
    ConfusionMatrixDisplay,
    accuracy_score,
    classification_report,
    confusion_matrix,
    precision_recall_fscore_support,
)
from sklearn.model_selection import GridSearchCV, StratifiedKFold, train_test_split  # noqa: E402
from sklearn.naive_bayes import MultinomialNB  # noqa: E402
from sklearn.pipeline import Pipeline  # noqa: E402
from scipy.stats import binomtest  # noqa: E402
from sklearn.svm import LinearSVC  # noqa: E402

from ml.text_utils import build_text, normalise_title  # noqa: E402

MAIN_MODEL = "linear_svm"


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", default=Path("data/processed/sample.jsonl.gz"), type=Path)
    parser.add_argument("--manifest", default=Path("data/processed/manifest.json"), type=Path)
    parser.add_argument("--run-name", default="svm_tfidf_v1")
    parser.add_argument("--models-dir", default=Path("models"), type=Path)
    parser.add_argument("--reports-dir", default=Path("reports"), type=Path)
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--cv-folds", type=int, default=5)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--n-jobs", type=int, default=-1)
    return parser.parse_args(argv)


def load_sample(path):
    with gzip.open(path, "rt", encoding="utf-8") as source:
        papers = [json.loads(line) for line in source]
    ids = [p["id"] for p in papers]
    if len(set(ids)) != len(ids):
        sys.exit("The sample contains duplicate ids; re-run ml.prepare_data.")
    return papers


def tfidf():
    return TfidfVectorizer(
        lowercase=True,
        strip_accents="unicode",
        stop_words="english",
        ngram_range=(1, 2),
        min_df=2,
        sublinear_tf=True,
    )


def candidate_models(seed):
    """name -> (estimator, parameter grid searched by cross-validation on the training set)."""
    return {
        MAIN_MODEL: (
            Pipeline([("tfidf", tfidf()), ("clf", LinearSVC(max_iter=10_000, random_state=seed))]),
            {"clf__C": [0.1, 0.5, 1.0, 2.0]},
        ),
        "multinomial_nb": (
            Pipeline([("tfidf", tfidf()), ("clf", MultinomialNB())]),
            {"clf__alpha": [0.01, 0.1, 0.5, 1.0]},
        ),
        "majority_class": (DummyClassifier(strategy="most_frequent"), None),
    }


def mcnemar_svm_vs_nb(y_true, fitted):
    """Exact McNemar test on the same test papers: is the SVM/Naive Bayes difference larger than chance?

    Only papers that exactly one of the two models gets right carry information; under
    "no difference" each such paper is equally likely to favour either model.
    """
    svm_ok = fitted[MAIN_MODEL][1] == y_true
    nb_ok = fitted["multinomial_nb"][1] == y_true
    only_svm, only_nb = int((svm_ok & ~nb_ok).sum()), int((~svm_ok & nb_ok).sum())
    p_value = binomtest(only_svm, only_svm + only_nb, 0.5).pvalue if only_svm + only_nb else 1.0
    return {
        "test": "exact McNemar (two-sided binomial test on discordant papers)",
        "only_svm_correct": only_svm,
        "only_nb_correct": only_nb,
        "p_value": float(p_value),
        "significant_at_0.05": bool(p_value < 0.05),
    }


def test_metrics(y_true, y_pred, labels):
    macro = precision_recall_fscore_support(y_true, y_pred, labels=labels, average="macro", zero_division=0)
    weighted = precision_recall_fscore_support(y_true, y_pred, labels=labels, average="weighted", zero_division=0)
    per_class = precision_recall_fscore_support(y_true, y_pred, labels=labels, average=None, zero_division=0)
    return {
        "accuracy": accuracy_score(y_true, y_pred),
        "macro_precision": macro[0],
        "macro_recall": macro[1],
        "macro_f1": macro[2],
        "weighted_precision": weighted[0],
        "weighted_recall": weighted[1],
        "weighted_f1": weighted[2],
        "per_class": {
            label: {
                "precision": per_class[0][i],
                "recall": per_class[1][i],
                "f1": per_class[2][i],
                "support": int(per_class[3][i]),
            }
            for i, label in enumerate(labels)
        },
    }


def rounded(value):
    if isinstance(value, dict):
        return {k: rounded(v) for k, v in value.items()}
    if isinstance(value, (float, np.floating)):
        return round(float(value), 4)
    return value


def write_csv(path, header, rows):
    with path.open("w", newline="", encoding="utf-8") as out:
        writer = csv.writer(out)
        writer.writerow(header)
        writer.writerows(rows)


def save_confusion_matrix(cm, labels, report_dir, title):
    write_csv(report_dir / "confusion_matrix.csv", ["true \\ predicted", *labels],
              [[label, *map(int, row)] for label, row in zip(labels, cm)])
    fig, ax = plt.subplots(figsize=(7, 6))
    ConfusionMatrixDisplay(cm, display_labels=labels).plot(ax=ax, cmap="Blues", values_format="d", colorbar=False)
    ax.set_title(title)
    fig.tight_layout()
    fig.savefig(report_dir / "confusion_matrix.png", dpi=150)
    plt.close(fig)


def top_terms(pipeline, labels, k=15):
    names = pipeline.named_steps["tfidf"].get_feature_names_out()
    classes = list(pipeline.named_steps["clf"].classes_)
    coef = pipeline.named_steps["clf"].coef_
    rows = []
    for label in labels:
        weights = coef[classes.index(label)]
        for rank, j in enumerate(np.argsort(weights)[::-1][:k], start=1):
            rows.append([label, rank, names[j], round(float(weights[j]), 4)])
    return rows


def check_no_leakage(papers, idx_train, idx_test):
    """Stops the run if any paper id or normalised title appears in both train and test."""
    train_ids = {papers[i]["id"] for i in idx_train}
    train_titles = {normalise_title(papers[i]["title"]) for i in idx_train}
    shared_ids = sum(papers[i]["id"] in train_ids for i in idx_test)
    shared_titles = sum(normalise_title(papers[i]["title"]) in train_titles for i in idx_test)
    if shared_ids or shared_titles:
        sys.exit(f"Leakage check failed: {shared_ids} shared ids, {shared_titles} shared titles.")
    return {"shared_ids": shared_ids, "test_titles_seen_in_train": shared_titles}


def evaluate_models(X_train, y_train, X_test, y_test, labels, seed, cv_folds, n_jobs):
    """Selects each candidate's parameters by CV on the training set, then scores the test set once.

    Returns (results, fitted, svm_cv_rows): metrics per model, (model, test predictions) per
    model, and the cross-validation table of the main model.
    """
    cv = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=seed)
    results, fitted, svm_cv_rows = {}, {}, []
    for name, (estimator, grid) in candidate_models(seed).items():
        print(f"Training {name} ...", file=sys.stderr)
        t0 = time.perf_counter()
        if grid:
            search = GridSearchCV(estimator, grid, scoring="f1_macro", cv=cv, n_jobs=n_jobs, refit=True)
            search.fit(X_train, y_train)
            model = search.best_estimator_
            best = search.best_index_
            cv_summary = {
                "best_params": search.best_params_,
                "cv_macro_f1_mean": search.cv_results_["mean_test_score"][best],
                "cv_macro_f1_std": search.cv_results_["std_test_score"][best],
            }
            if name == MAIN_MODEL:
                svm_cv_rows = [
                    [json.dumps(p), round(m, 4), round(s, 4)]
                    for p, m, s in zip(search.cv_results_["params"], search.cv_results_["mean_test_score"],
                                       search.cv_results_["std_test_score"])
                ]
        else:
            model = estimator.fit(X_train, y_train)
            cv_summary = {"best_params": {}, "cv_macro_f1_mean": None, "cv_macro_f1_std": None}
        train_seconds = time.perf_counter() - t0
        y_pred = model.predict(X_test)
        results[name] = {**cv_summary, "train_seconds": train_seconds, "test": test_metrics(y_test, y_pred, labels)}
        fitted[name] = (model, y_pred)
        print(f"  test accuracy {results[name]['test']['accuracy']:.4f}, "
              f"macro-F1 {results[name]['test']['macro_f1']:.4f}", file=sys.stderr)
    return results, fitted, svm_cv_rows


def write_model_reports(report_dir, results, fitted, svm_cv_rows, labels, y_test, test_ids, test_titles, cm_title):
    """The report files shared by every evaluation run (all except metrics.json and split.json)."""
    svm, svm_pred = fitted[MAIN_MODEL]
    write_csv(report_dir / "cv_results.csv", ["params", "mean_macro_f1", "std_macro_f1"], svm_cv_rows)
    (report_dir / "test_ids.txt").write_text("\n".join(sorted(test_ids)) + "\n", encoding="utf-8")
    (report_dir / "classification_report.txt").write_text(
        classification_report(y_test, svm_pred, labels=labels, digits=4, zero_division=0), encoding="utf-8"
    )
    save_confusion_matrix(confusion_matrix(y_test, svm_pred, labels=labels), labels, report_dir, cm_title)
    write_csv(report_dir / "baseline_comparison.csv",
              ["model", "best_params", "cv_macro_f1_mean", "cv_macro_f1_std",
               "test_accuracy", "test_macro_precision", "test_macro_recall", "test_macro_f1"],
              [[name, json.dumps(r["best_params"]), rounded(r["cv_macro_f1_mean"]), rounded(r["cv_macro_f1_std"]),
                rounded(r["test"]["accuracy"]), rounded(r["test"]["macro_precision"]),
                rounded(r["test"]["macro_recall"]), rounded(r["test"]["macro_f1"])]
               for name, r in results.items()])
    write_csv(report_dir / "top_terms.csv", ["category", "rank", "term", "svm_weight"], top_terms(svm, labels))
    write_csv(report_dir / "misclassified_test.csv", ["id", "true", "predicted", "title"],
              [[test_ids[k], y_test[k], svm_pred[k], test_titles[k]]
               for k in range(len(y_test)) if y_test[k] != svm_pred[k]])


def main(argv=None):
    args = parse_args(argv)
    if not args.data.is_file():
        sys.exit(f"Sample not found: {args.data}. Run `python -m ml.prepare_data` first.")
    started = datetime.now(timezone.utc)
    manifest = json.loads(args.manifest.read_text(encoding="utf-8")) if args.manifest.is_file() else None

    papers = load_sample(args.data)
    texts = np.array([build_text(p["title"], p["abstract"]) for p in papers], dtype=object)
    y = np.array([p["label"] for p in papers])
    ids = np.array([p["id"] for p in papers])
    labels = sorted(set(y))

    # 1. Split once, before anything is fitted.
    idx_train, idx_test = train_test_split(
        np.arange(len(papers)), test_size=args.test_size, stratify=y, random_state=args.seed
    )
    leakage = check_no_leakage(papers, idx_train, idx_test)
    X_train, X_test, y_train, y_test = texts[idx_train], texts[idx_test], y[idx_train], y[idx_test]

    report_dir = args.reports_dir / args.run_name
    report_dir.mkdir(parents=True, exist_ok=True)
    args.models_dir.mkdir(parents=True, exist_ok=True)

    # 2-3. Model selection on the training set only; one score on the test set per model.
    results, fitted, svm_cv_rows = evaluate_models(
        X_train, y_train, X_test, y_test, labels, args.seed, args.cv_folds, args.n_jobs
    )
    svm = fitted[MAIN_MODEL][0]

    split = {
        "method": "stratified random split (sklearn train_test_split)",
        "seed": args.seed,
        "test_size": args.test_size,
        "cv_folds_on_train": args.cv_folds,
        "train_total": len(idx_train),
        "test_total": len(idx_test),
        "train_by_category": {label: int((y_train == label).sum()) for label in labels},
        "test_by_category": {label: int((y_test == label).sum()) for label in labels},
        "leakage_checks": leakage,
    }
    (report_dir / "split.json").write_text(json.dumps(split, indent=2) + "\n", encoding="utf-8")

    metrics = {
        "run_name": args.run_name,
        "created_at": started.isoformat(timespec="seconds"),
        "main_model": MAIN_MODEL,
        "labels": labels,
        "sample_content_sha256": manifest["sample"]["content_sha256"] if manifest else None,
        "split": split,
        "models": rounded(results),
        "svm_vs_nb": mcnemar_svm_vs_nb(y_test, fitted),
    }
    (report_dir / "metrics.json").write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    write_model_reports(report_dir, results, fitted, svm_cv_rows, labels, y_test, ids[idx_test],
                        [papers[i]["title"] for i in idx_test],
                        f"TF-IDF + Linear SVM, test set (n={len(idx_test)})")

    # Model artifacts.
    joblib.dump(svm, args.models_dir / f"{args.run_name}.joblib")
    (args.models_dir / "labels.json").write_text(json.dumps(labels, indent=2) + "\n", encoding="utf-8")
    info = {
        "run_name": args.run_name,
        "created_at": metrics["created_at"],
        "model": "TfidfVectorizer(ngram_range=(1,2), sublinear_tf, min_df=2, english stop words) + LinearSVC",
        "best_params": results[MAIN_MODEL]["best_params"],
        "labels": labels,
        "trained_on": "training split only (see reports/<run>/split.json)",
        "train_size": len(idx_train),
        "sample_content_sha256": metrics["sample_content_sha256"],
        "input": "ml.text_utils.build_text(title, abstract)",
        "versions": {"python": platform.python_version(), "scikit-learn": sklearn.__version__,
                     "numpy": np.__version__},
    }
    (args.models_dir / f"{args.run_name}_info.json").write_text(json.dumps(info, indent=2) + "\n", encoding="utf-8")
    # Copies kept with the committed reports, so every result can be traced to its data and library versions.
    (report_dir / "model_info.json").write_text(json.dumps(info, indent=2) + "\n", encoding="utf-8")
    if manifest:
        (report_dir / "data_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    print(f"\nReports in {report_dir}, model in {args.models_dir / (args.run_name + '.joblib')}", file=sys.stderr)


if __name__ == "__main__":
    main()
