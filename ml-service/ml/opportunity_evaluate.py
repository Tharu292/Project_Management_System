"""Evaluation of the research-opportunity analysis (what can honestly be measured without expert labels).

No human relevance judgements exist for "research opportunities", so accuracy
cannot be measured here. This script reports, on held-out query papers first
submitted in --query-year (each query paper is excluded from its own evidence):

1. Groundedness: share of directions backed by >= 3 real supporting papers.
2. Availability: share of queries that receive >= 3 eligible directions.
3. Topic agreement: share of directions whose two topics are both among the
   query text's OWN 5 strongest NMF topics (the profile also uses neighbours).
4. Stability: mean Jaccard overlap of the top-5 direction sets when 20% of the
   abstract's words are removed at random (seeded).
5. Coverage notes: how often the "dataset coverage" warning is shown.
6. Temporal backtest of the growth signal (no queries): over topic pairs with
   enough papers, Spearman correlation between growth 2016-17 -> 2020-21 and
   growth 2020-21 -> 2024-25. It tests whether past growth carried on, nothing more.
7. Case studies (one query per category) and a blank expert-review sheet.

Usage:
  python -m ml.opportunity_evaluate
"""

import argparse
import csv
import gzip
import json
import random
import sys
from pathlib import Path

import numpy as np
from scipy.stats import spearmanr

from ml.opportunity import OpportunityEngine
from ml.prepare_data import sampling_key

RUBRIC = ["relevance_1to5", "specificity_1to5", "evidence_supports_claim_1to5",
          "plausibly_less_studied_yes_no_unsure", "reviewer", "notes"]


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--corpus", default=Path("data/opportunity/corpus.jsonl.gz"), type=Path)
    parser.add_argument("--models-dir", default=Path("models/opportunity"), type=Path)
    parser.add_argument("--reports-dir", default=Path("reports/opportunity"), type=Path)
    parser.add_argument("--query-year", type=int, default=2026)
    parser.add_argument("--queries", type=int, default=100)
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args(argv)


def split_text(text):
    """The corpus text is 'title abstract'; the title is not stored separately here, so use the first sentence."""
    head, _, rest = text.partition(". ")
    return (head, rest) if rest else (text[:120], text)


def drop_words(text, fraction, rng):
    words = text.split()
    keep = [w for w in words if rng.random() >= fraction]
    return " ".join(keep) if len(keep) >= 30 else text


def backtest(engine):
    """Does a topic pair's earlier growth predict its later growth? Real counts only."""
    def window(span):
        idx = [i for i, y in enumerate(engine.year_list) if y in span]
        return engine.by_year[idx].sum(axis=0), max(int(engine.papers_per_year[idx].sum()), 1)
    a, na = window([2016, 2017])
    b, nb = window([2020, 2021])
    c, nc = window([2024, 2025])
    iu = np.triu_indices_from(a, k=1)
    mask = (a[iu] >= 10) & (b[iu] >= 10)
    eps = 1e-4
    earlier = np.log((b[iu][mask] / nb + eps) / (a[iu][mask] / na + eps))
    later = np.log((c[iu][mask] / nc + eps) / (b[iu][mask] / nb + eps))
    rho, p = spearmanr(earlier, later)
    top = earlier >= np.quantile(earlier, 0.75)
    return {
        "question": "Did topic pairs that grew from 2016-17 to 2020-21 keep growing to 2024-25?",
        "pairs": int(mask.sum()), "min_papers_per_window": 10,
        "spearman_rho": round(float(rho), 4), "p_value": float(p),
        "later_growth_median_top_quartile_earlier": round(float(np.median(later[top])), 4),
        "later_growth_median_other_pairs": round(float(np.median(later[~top])), 4),
        "note": "Tests only whether the growth factor carries information about later growth; it is not a test "
                "of whether a suggested direction is a real research gap.",
    }


def main(argv=None):
    args = parse_args(argv)
    engine = OpportunityEngine(args.models_dir)
    with gzip.open(args.corpus, "rt", encoding="utf-8") as source:
        papers = [json.loads(line) for line in source]
    pool = [p for p in papers if p["year"] == args.query_year]
    queries = sorted(pool, key=lambda p: sampling_key(args.seed + 2, p["id"]))[: args.queries]
    rng = random.Random(args.seed)

    grounded = available = agree = total_dirs = coverage_flags = 0
    jaccards, reviews, cases = [], [], {}
    for q in queries:
        title, abstract = split_text(q["text"])
        result = engine.analyse(title, abstract, exclude_id=q["id"])
        dirs = result["directions"]
        available += len(dirs) >= 3
        own = set(np.argsort(engine.topic_shares(q["text"]))[::-1][:5].tolist())
        for d in dirs:
            total_dirs += 1
            grounded += len(d["supportingPapers"]) >= 3
            agree += all(t["topicId"] in own for t in d["topics"])
            coverage_flags += d["coverage"]["assessment"] == "dataset_coverage"
        perturbed = engine.analyse(title, drop_words(abstract, 0.2, rng), exclude_id=q["id"])
        first = {tuple(t["topicId"] for t in d["topics"]) for d in dirs}
        second = {tuple(t["topicId"] for t in d["topics"]) for d in perturbed["directions"]}
        if first or second:
            jaccards.append(len(first & second) / len(first | second))
        if q["primary"] not in cases:
            cases[q["primary"]] = {"query": {"arxivId": q["id"], "title": title, "primaryCategory": q["primary"]},
                                   "result": {k: result[k] for k in ("similarPapers", "topicProfile", "directions")}}
            for d in dirs:
                reviews.append([q["id"], title, d["rank"], d["title"], d["score"], d["evidence"]["recentPapers"],
                                d["evidence"]["olderPapers"], d["coverage"]["assessment"],
                                " ".join(p["arxivId"] for p in d["supportingPapers"])] + [""] * len(RUBRIC))

    report = {
        "status": "No expert ratings yet: recommendation accuracy is NOT measured. The figures below are "
                  "automatic checks of grounding, agreement and stability, plus a backtest of the growth factor.",
        "queries": {"count": len(queries), "selection": f"hash-ranked corpus papers first submitted in {args.query_year} "
                    "(seed {}); each query paper is excluded from its own neighbours and supporting papers".format(args.seed + 2)},
        "directions_returned": total_dirs,
        "groundedness_share_with_3plus_supporting_papers": round(grounded / max(total_dirs, 1), 4),
        "availability_share_with_3plus_directions": round(available / max(len(queries), 1), 4),
        "topic_agreement_share": round(agree / max(total_dirs, 1), 4),
        "stability_mean_jaccard_top5_after_dropping_20pct_words": round(float(np.mean(jaccards)), 4) if jaccards else None,
        "dataset_coverage_warning_share": round(coverage_flags / max(total_dirs, 1), 4),
        "temporal_backtest_of_growth_signal": backtest(engine),
        "expert_review": {"done": False, "sheet": "reports/opportunity/expert_review_sheet.csv",
                          "rubric": RUBRIC},
    }
    args.reports_dir.mkdir(parents=True, exist_ok=True)
    (args.reports_dir / "recommendation_evaluation.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    (args.reports_dir / "case_studies.json").write_text(json.dumps(cases, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    with (args.reports_dir / "expert_review_sheet.csv").open("w", newline="", encoding="utf-8") as out:
        writer = csv.writer(out)
        writer.writerow(["query_arxiv_id", "query_title", "rank", "direction", "score", "recent_papers",
                         "older_papers", "coverage_assessment", "supporting_arxiv_ids"] + RUBRIC)
        writer.writerows(reviews)
    print(json.dumps(report, indent=2), file=sys.stderr)


if __name__ == "__main__":
    main()
