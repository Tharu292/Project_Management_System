"""Computes review metrics from the MANUALLY labelled sheets in reports/gap/review/.

Only rows that carry a label are used; nothing is estimated for unlabelled rows.
A metric is reported only when at least one row is labelled, with its number of
labelled rows and a Wilson 95% interval; below MIN_RELIABLE labelled rows it is
marked as too few for a reliable estimate. With no labels at all, the status stays
"not measured".

Writes reports/gap/review/review_status.json (keeping the labelling instructions).

Usage:
  python -m ml.gap_metrics
"""

import argparse
import csv
import json
from collections import Counter
from pathlib import Path

from ml.gap_analysis import wilson

MIN_RELIABLE = 30
YES, NO = {"yes", "y", "true", "1"}, {"no", "n", "false", "0"}


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--review-dir", default=Path("reports/gap/review"), type=Path)
    return parser.parse_args(argv)


def read(path):
    if not path.is_file():
        return []
    with path.open(encoding="utf-8", newline="") as source:
        return list(csv.DictReader(source))


def column(rows, prefix):
    if not rows:
        return None
    return next((name for name in rows[0] if name.startswith(prefix)), None)


def proportion(hits, total):
    if total == 0:
        return None
    low, high = wilson(hits, total)
    return {"value": round(hits / total, 4), "interval95": [round(low, 4), round(high, 4)], "labelled": total,
            "reliable": total >= MIN_RELIABLE}


def yes_no_precision(rows, prefix):
    name = column(rows, prefix)
    labelled = [r for r in rows if name and r[name].strip().lower() in YES | NO]
    return proportion(sum(r[name].strip().lower() in YES for r in labelled), len(labelled))


def compute(review_dir):
    a = read(review_dir / "a_statements.csv")
    name = column(a, "label_type_correct")
    labelled_a = [r for r in a if name and r[name].strip().lower() in YES | NO]
    statements = {"overall": proportion(sum(r[name].strip().lower() in YES for r in labelled_a), len(labelled_a))}
    for kind in sorted({r["predicted_type"] for r in labelled_a}):
        rows = [r for r in labelled_a if r["predicted_type"] == kind]
        statements[kind] = proportion(sum(r[name].strip().lower() in YES for r in rows), len(rows))
    quote_exact = yes_no_precision(a, "label_quote_is_exact")

    e = read(review_dir / "e_recall_sentences.csv")
    true_col = column(e, "label_true_type")
    labelled_e = [r for r in e if true_col and r[true_col].strip()]
    positives = [r for r in labelled_e if r[true_col].strip() != "none"]
    recall = {
        "any_statement": proportion(sum(r["predicted_type"] != "none" for r in positives), len(positives)),
        "exact_type": proportion(sum(r["predicted_type"] == r[true_col].strip() for r in positives), len(positives)),
        "labelled_sentences": len(labelled_e),
    }

    d = read(review_dir / "d_case_studies.csv")
    judge_col = column(d, "label_judgement")
    judged = [r for r in d if judge_col and r[judge_col].strip()]
    judgements = {}
    groups = {kind: [r for r in judged if r["finding_kind"] == kind] for kind in sorted({r["finding_kind"] for r in judged})}
    if judged and "uncertainty" in judged[0]:
        groups.update({f"uncertainty:{u}": [r for r in judged if r["uncertainty"] == u]
                       for u in sorted({r["uncertainty"] for r in judged})})
    for kind, rows in groups.items():
        counts = Counter(r[judge_col].strip().lower() for r in rows)
        judgements[kind] = {"labelled": len(rows), "counts": dict(counts),
                            "supported_or_plausible": proportion(counts["supported"] + counts["plausible"], len(rows))}

    metrics = {
        "statement_type_precision": statements,
        "quote_exactness": quote_exact,
        "dataset_name_precision": yes_no_precision(read(review_dir / "b_datasets.csv"), "label_is_a_dataset"),
        "aspect_match_precision": yes_no_precision(read(review_dir / "c_aspects.csv"), "label_paper_really"),
        "statement_recall": recall,
        "case_study_judgements": judgements,
    }
    any_labels = bool(labelled_a or labelled_e or judged or (metrics["dataset_name_precision"] or {}).get("labelled")
                      or (metrics["aspect_match_precision"] or {}).get("labelled"))
    return any_labels, metrics


def main(argv=None):
    args = parse_args(argv)
    path = args.review_dir / "review_status.json"
    status = json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}
    labelled, metrics = compute(args.review_dir)
    status["labelled"] = labelled
    if labelled:
        status["status"] = ("Metrics below come only from the manually labelled rows. Estimates from fewer than "
                            f"{MIN_RELIABLE} labelled rows are marked as not reliable.")
        status["metrics"] = metrics
    else:
        status["status"] = "No manual labels yet: extraction precision, recall and gap-identification accuracy are NOT measured."
        status.pop("metrics", None)
    path.write_text(json.dumps(status, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"labelled": labelled, **({"metrics": metrics} if labelled else {})}, indent=2))


if __name__ == "__main__":
    main()
