"""TF-IDF similar-paper retrieval over the opportunity corpus, and its evaluation.

Index: the vocabulary (words and word pairs) is learned from a hash-ranked sample
of the corpus (to fit in memory); counts for every paper are then weighted with
IDF computed over the whole corpus (sublinear TF, L2-normalised rows), so a
dot product is the cosine similarity.

Evaluation (reports/opportunity/retrieval_metrics.json). The arXiv metadata has
no human relevance judgements, so:
* Known-item search: the query is a paper's TITLE only; the one relevant
  document is that paper. Recall@1/5/10 and MRR are valid for this task only.
* Category agreement@10: share of the 10 nearest OTHER papers (query = title +
  abstract) whose primary category equals the query's. A proxy for topical
  relevance, compared with the agreement expected from random neighbours.

Usage:
  python -m ml.opportunity_retrieval
"""

import argparse
import gzip
import json
import sys
import time
from collections import Counter
from pathlib import Path

import joblib
import numpy as np
from scipy import sparse
from sklearn.feature_extraction.text import CountVectorizer, TfidfTransformer

from ml.prepare_data import sampling_key

VOCAB_SAMPLE = 80_000


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--corpus", default=Path("data/opportunity/corpus.jsonl.gz"), type=Path)
    parser.add_argument("--models-dir", default=Path("models/opportunity"), type=Path)
    parser.add_argument("--reports-dir", default=Path("reports/opportunity"), type=Path)
    parser.add_argument("--eval-queries", type=int, default=1000)
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args(argv)


def load_corpus(path):
    with gzip.open(path, "rt", encoding="utf-8") as source:
        return [json.loads(line) for line in source]


def build_index(papers, seed):
    sample = sorted(range(len(papers)), key=lambda i: sampling_key(seed, papers[i]["id"]))[:VOCAB_SAMPLE]
    counter = CountVectorizer(lowercase=True, strip_accents="unicode", stop_words="english", ngram_range=(1, 2),
                              min_df=5, max_df=0.5, max_features=250_000, dtype=np.float32)
    counter.fit(papers[i]["text"] for i in sample)
    chunks = [counter.transform(p["text"] for p in papers[start:start + 50_000])
              for start in range(0, len(papers), 50_000)]
    counts = sparse.vstack(chunks).tocsr()
    weigher = TfidfTransformer(sublinear_tf=True)
    matrix = weigher.fit_transform(counts).astype(np.float32).tocsr()
    return counter, weigher, matrix


def scores(query_vector, matrix):
    return np.asarray((matrix @ query_vector.T).todense()).ravel()


def evaluate(papers, counter, weigher, matrix, n_queries, seed):
    ranked = sorted(range(len(papers)), key=lambda i: sampling_key(seed + 1, papers[i]["id"]))[:n_queries]
    primaries = np.array([p["primary"] for p in papers])
    prior = {c: n / len(papers) for c, n in Counter(primaries).items()}

    ranks, agreements, timings = [], [], []
    for i in ranked:
        # Known item: title only, find the paper itself among all papers.
        q = weigher.transform(counter.transform([papers[i]["title"]]))
        s = scores(q, matrix)
        ranks.append(int((s > s[i]).sum()) + 1)
        # Category agreement: full text, the paper itself excluded.
        start = time.perf_counter()
        q = weigher.transform(counter.transform([papers[i]["text"]]))
        s = scores(q, matrix)
        s[i] = -1.0
        top = np.argpartition(-s, 10)[:10]
        timings.append(time.perf_counter() - start)
        agreements.append(float((primaries[top] == papers[i]["primary"]).mean()))

    ranks = np.array(ranks)
    expected_random = float(np.mean([prior[papers[i]["primary"]] for i in ranked]))
    return {
        "queries": len(ranked),
        "query_sampling": f"{len(ranked)} hash-ranked corpus papers (seed {seed + 1}); no parameter was tuned on them",
        "known_item_search": {
            "task": "query = the paper's title only; the single relevant document = that paper",
            "recall_at_1": round(float((ranks <= 1).mean()), 4),
            "recall_at_5": round(float((ranks <= 5).mean()), 4),
            "recall_at_10": round(float((ranks <= 10).mean()), 4),
            "mrr": round(float((1.0 / ranks).mean()), 4),
            "median_rank": float(np.median(ranks)),
            "random_ranking_recall_at_10": round(10 / len(papers), 6),
        },
        "category_agreement_at_10": {
            "task": "query = title + abstract; share of the 10 nearest other papers with the same primary category",
            "mean": round(float(np.mean(agreements)), 4),
            "expected_for_random_neighbours": round(expected_random, 4),
            "note": "A proxy for topical relevance only: neighbours from another category can still be relevant.",
        },
        "latency_ms_median": round(float(np.median(timings)) * 1000, 1),
    }


def main(argv=None):
    args = parse_args(argv)
    t0 = time.perf_counter()
    papers = load_corpus(args.corpus)
    print(f"loaded {len(papers):,} papers", file=sys.stderr)
    counter, weigher, matrix = build_index(papers, args.seed)
    print(f"index: {matrix.shape[0]:,} x {matrix.shape[1]:,}, {matrix.nnz:,} non-zeros", file=sys.stderr)

    args.models_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump({"counter": counter, "weigher": weigher}, args.models_dir / "retrieval_vectorizer.joblib")
    sparse.save_npz(args.models_dir / "retrieval_matrix.npz", matrix, compressed=False)
    joblib.dump({
        "ids": np.array([p["id"] for p in papers]),
        "titles": np.array([p["title"] for p in papers], dtype=object),
        "years": np.array([p["year"] for p in papers], dtype=np.int16),
        "primary": np.array([p["primary"] for p in papers]),
        "categories": np.array([" ".join(p["categories"]) for p in papers], dtype=object),
    }, args.models_dir / "corpus_meta.joblib")

    metrics = evaluate(papers, counter, weigher, matrix, args.eval_queries, args.seed)
    metrics["index"] = {"papers": matrix.shape[0], "terms": matrix.shape[1], "non_zeros": int(matrix.nnz),
                        "vocabulary_sample": VOCAB_SAMPLE, "ngram_range": [1, 2], "min_df": 5, "max_df": 0.5,
                        "weighting": "sublinear TF x IDF over the whole corpus, L2-normalised (dot product = cosine)"}
    metrics["build_seconds"] = round(time.perf_counter() - t0, 1)
    args.reports_dir.mkdir(parents=True, exist_ok=True)
    (args.reports_dir / "retrieval_metrics.json").write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metrics, indent=2), file=sys.stderr)


if __name__ == "__main__":
    main()
