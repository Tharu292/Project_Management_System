"""Temporal evaluation: train on earlier papers, test on later ones.

The random 80/20 split (ml.train_classifier) measures performance on papers from
the same years as the training data. Here the model is trained only on papers
first submitted in the train years and tested only on papers from the later test
years, which shows how well it carries over to newer research, whose vocabulary
has moved on (for example, new model names and methods).

The protocol is the same as ml.train_classifier: the same filters, labels and
hash-ranked sampling as ml.prepare_data, the same candidate models and grids, CV
on the training data only, one score on the test data. The sizes default to the
random split's (1,600 train and 400 test papers per category), so the two
results can be compared directly. This run evaluates only; it saves no model.

Usage:
  python -m ml.temporal_eval --input data/raw/arxiv-metadata-oai-snapshot.json
"""

import argparse
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from ml.prepare_data import DEFAULT_CATEGORIES, LABEL_POLICY, read_candidates, remove_duplicates, sampling_key
from ml.text_utils import build_text
from ml.train_classifier import (
    MAIN_MODEL,
    check_no_leakage,
    evaluate_models,
    mcnemar_svm_vs_nb,
    rounded,
    test_metrics,
    write_model_reports,
)


def year_range(text):
    first, _, last = text.partition("-")
    return int(first), int(last or first)


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input", required=True, type=Path, help="arxiv-metadata-oai-snapshot.json")
    parser.add_argument("--categories", nargs="+", default=DEFAULT_CATEGORIES)
    parser.add_argument("--train-years", default="2018-2022")
    parser.add_argument("--test-years", default="2023-2024")
    parser.add_argument("--train-per-category", type=int, default=1600)
    parser.add_argument("--test-per-category", type=int, default=400)
    parser.add_argument("--min-abstract-words", type=int, default=30)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--cv-folds", type=int, default=5)
    parser.add_argument("--n-jobs", type=int, default=-1)
    parser.add_argument("--run-name", default="svm_tfidf_v1_temporal")
    parser.add_argument("--reports-dir", default=Path("reports"), type=Path)
    args = parser.parse_args(argv)
    args.train_from, args.train_to = year_range(args.train_years)
    args.test_from, args.test_to = year_range(args.test_years)
    if not args.train_from <= args.train_to < args.test_from <= args.test_to:
        parser.error("train years must come entirely before test years")
    # read_candidates() filters on this window.
    args.year_from, args.year_to = args.train_from, args.test_to
    return args


def take(papers, label, n, seed):
    ranked = sorted((p for p in papers if p["label"] == label), key=lambda p: sampling_key(seed, p["id"]))
    return ranked[:n]


def main(argv=None):
    args = parse_args(argv)
    if not args.input.is_file():
        sys.exit(f"Dataset not found: {args.input}\nSee docs/dataset.md for how to download it.")
    started = datetime.now(timezone.utc)

    stats = Counter()
    print(f"Reading {args.input} ...", file=sys.stderr)
    candidates, dataset_sha256 = read_candidates(args, stats)
    unique = remove_duplicates(candidates, stats)
    train_pool = [p for p in unique if args.train_from <= p["year"] <= args.train_to]
    test_pool = [p for p in unique if args.test_from <= p["year"] <= args.test_to]

    train, test = [], []
    for label in args.categories:
        train += take(train_pool, label, args.train_per_category, args.seed)
        test += take(test_pool, label, args.test_per_category, args.seed)
    train.sort(key=lambda p: p["id"])
    test.sort(key=lambda p: p["id"])
    papers = train + test
    idx_train, idx_test = np.arange(len(train)), np.arange(len(train), len(papers))
    leakage = check_no_leakage(papers, idx_train, idx_test)

    texts = np.array([build_text(p["title"], p["abstract"]) for p in papers], dtype=object)
    y = np.array([p["label"] for p in papers])
    years = np.array([p["year"] for p in papers])
    ids = np.array([p["id"] for p in papers])
    labels = sorted(args.categories)
    X_train, X_test, y_train, y_test = texts[idx_train], texts[idx_test], y[idx_train], y[idx_test]

    results, fitted, svm_cv_rows = evaluate_models(
        X_train, y_train, X_test, y_test, labels, args.seed, args.cv_folds, args.n_jobs
    )

    # The same predictions broken down by test year: does performance drop further from the training period?
    by_test_year = {}
    for year in range(args.test_from, args.test_to + 1):
        mask = years[idx_test] == year
        if mask.any():
            by_test_year[str(year)] = {
                "n": int(mask.sum()),
                **{name: {k: v for k, v in test_metrics(y_test[mask], pred[mask], labels).items() if k != "per_class"}
                   for name, (_, pred) in fitted.items() if name != "majority_class"},
            }

    split = {
        "method": "temporal: train and test papers come from disjoint submission-year ranges",
        "train_years": [args.train_from, args.train_to],
        "test_years": [args.test_from, args.test_to],
        "seed": args.seed,
        "sampling": "N smallest sha256('<seed>:<arxiv id>') per category within each period",
        "cv_folds_on_train": args.cv_folds,
        "train_total": len(train),
        "test_total": len(test),
        "train_by_category": dict(Counter(p["label"] for p in train)),
        "test_by_category": dict(Counter(p["label"] for p in test)),
        "test_by_year": {str(k): v for k, v in sorted(Counter(p["year"] for p in test).items())},
        "eligible_by_period": {
            "train": dict(Counter(p["label"] for p in train_pool)),
            "test": dict(Counter(p["label"] for p in test_pool)),
        },
        "leakage_checks": leakage,
    }
    shortfalls = {
        label: {"train": split["train_by_category"].get(label, 0), "test": split["test_by_category"].get(label, 0)}
        for label in args.categories
        if split["train_by_category"].get(label, 0) < args.train_per_category
        or split["test_by_category"].get(label, 0) < args.test_per_category
    }
    split["categories_below_target"] = shortfalls

    report_dir = args.reports_dir / args.run_name
    report_dir.mkdir(parents=True, exist_ok=True)
    (report_dir / "split.json").write_text(json.dumps(split, indent=2) + "\n", encoding="utf-8")
    metrics = {
        "run_name": args.run_name,
        "created_at": started.isoformat(timespec="seconds"),
        "main_model": MAIN_MODEL,
        "labels": labels,
        "label_policy": LABEL_POLICY,
        "dataset_sha256": dataset_sha256,
        "split": split,
        "models": rounded(results),
        "svm_vs_nb": mcnemar_svm_vs_nb(y_test, fitted),
        "by_test_year": rounded(by_test_year),
    }
    (report_dir / "metrics.json").write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    write_model_reports(report_dir, results, fitted, svm_cv_rows, labels, y_test, ids[idx_test],
                        [p["title"] for p in test],
                        f"Linear SVM, trained {args.train_from}-{args.train_to}, "
                        f"tested {args.test_from}-{args.test_to} (n={len(test)})")

    print(f"\nReports in {report_dir}", file=sys.stderr)
    if shortfalls:
        print(f"WARNING: fewer eligible papers than requested: {shortfalls}", file=sys.stderr)


if __name__ == "__main__":
    main()
