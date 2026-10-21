"""Interpretable topic discovery (NMF) and topic-combination coverage over the opportunity corpus.

1. Training data: a balanced hash-ranked sample (up to --per-category papers per
   category); a disjoint hash-ranked reference set is kept apart for evaluation.
2. Features: TF-IDF over words and word pairs (URLs and academic boilerplate
   removed, as in the keyword trends).
3. Model selection: NMF with k in --k-values topics; each k is scored by NPMI
   coherence of every topic's 10 top terms on the held-out reference set, and by
   topic diversity. The k with the highest mean NPMI is kept (smaller k on ties).
4. Coverage: every corpus paper gets its topic shares (NMF weights normalised to
   sum to 1). A paper "covers" a topic when its share is at least --share
   threshold. Paper counts per topic pair and year are stored, and the same counts
   for the control set (other cs.* categories) in the comparison windows.

Writes models/opportunity/topics.joblib and reports/opportunity/topic_model.json.

Usage:
  python -m ml.opportunity_topics
"""

import argparse
import gzip
import json
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

import joblib
import numpy as np
from sklearn.decomposition import NMF
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS, TfidfVectorizer

from ml.prepare_data import sampling_key
from ml.trends import ACADEMIC_STOP_WORDS, keyword_preprocess

TOKEN_PATTERN = r"(?u)\b[a-zA-Z][a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*\b"


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--corpus", default=Path("data/opportunity/corpus.jsonl.gz"), type=Path)
    parser.add_argument("--control", default=Path("data/opportunity/control.jsonl.gz"), type=Path)
    parser.add_argument("--models-dir", default=Path("models/opportunity"), type=Path)
    parser.add_argument("--reports-dir", default=Path("reports/opportunity"), type=Path)
    parser.add_argument("--per-category", type=int, default=15_000)
    parser.add_argument("--reference-size", type=int, default=20_000)
    parser.add_argument("--k-values", type=int, nargs="+", default=[20, 30, 40])
    parser.add_argument("--share-threshold", type=float, default=0.15)
    parser.add_argument("--old-window", default="2018-2019")
    parser.add_argument("--recent-window", default="2024-2025")
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args(argv)


def years(text):
    first, _, last = text.partition("-")
    return list(range(int(first), int(last or first) + 1))


def load(path):
    with gzip.open(path, "rt", encoding="utf-8") as source:
        return [json.loads(line) for line in source]


def npmi_scores(top_terms, binary):
    """Mean pairwise NPMI of each topic's top terms, from document co-occurrence in `binary` (docs x terms)."""
    n = binary.shape[0]
    results = []
    for terms in top_terms:
        cols = binary[:, terms].toarray().astype(bool)
        df = cols.sum(axis=0)
        values = []
        for a in range(len(terms)):
            for b in range(a + 1, len(terms)):
                joint = np.logical_and(cols[:, a], cols[:, b]).sum()
                if joint == 0 or df[a] == 0 or df[b] == 0:
                    values.append(-1.0)
                    continue
                p_ab, p_a, p_b = joint / n, df[a] / n, df[b] / n
                values.append(float(np.log(p_ab / (p_a * p_b)) / -np.log(p_ab)) if p_ab < 1 else 1.0)
        results.append(float(np.mean(values)))
    return results


def shares_of(nmf, matrix, chunk=50_000):
    parts = []
    for start in range(0, matrix.shape[0], chunk):
        w = nmf.transform(matrix[start:start + chunk]).astype(np.float32)
        total = w.sum(axis=1, keepdims=True)
        parts.append(np.divide(w, total, out=np.zeros_like(w), where=total > 0))
    return np.vstack(parts)


def pair_counts(covered):
    """Topic x topic paper counts; the diagonal is the number of papers covering each topic."""
    b = covered.astype(np.float32)
    return (b.T @ b).astype(np.int32)


def main(argv=None):
    args = parse_args(argv)
    t0 = time.perf_counter()
    papers = load(args.corpus)
    ranked = sorted(range(len(papers)), key=lambda i: sampling_key(args.seed, papers[i]["id"]))
    taken, train, reference = Counter(), [], []
    for i in ranked:
        cat = papers[i]["primary"]
        if taken[cat] < args.per_category:
            taken[cat] += 1
            train.append(i)
        elif len(reference) < args.reference_size:
            reference.append(i)
    print(f"train {len(train):,} ({dict(taken)}), reference {len(reference):,}", file=sys.stderr)

    vectorizer = TfidfVectorizer(lowercase=True, strip_accents="unicode", preprocessor=keyword_preprocess,
                                 stop_words=sorted(ENGLISH_STOP_WORDS | ACADEMIC_STOP_WORDS), token_pattern=TOKEN_PATTERN,
                                 ngram_range=(1, 2), min_df=20, max_df=0.3, max_features=20_000, sublinear_tf=True,
                                 dtype=np.float32)
    x_train = vectorizer.fit_transform(papers[i]["text"] for i in train)
    x_ref = vectorizer.transform(papers[i]["text"] for i in reference)
    ref_binary = (x_ref > 0).astype(np.int8).tocsc()
    terms = vectorizer.get_feature_names_out()

    # Model selection by held-out coherence.
    selection = []
    models = {}
    for k in args.k_values:
        start = time.perf_counter()
        nmf = NMF(n_components=k, init="nndsvda", random_state=args.seed, max_iter=400)
        nmf.fit(x_train)
        top10 = [list(np.argsort(row)[::-1][:10]) for row in nmf.components_]
        top25 = {t for row in nmf.components_ for t in np.argsort(row)[::-1][:25]}
        coherence = npmi_scores(top10, ref_binary)
        selection.append({"k": k, "mean_npmi": round(float(np.mean(coherence)), 4),
                          "median_npmi": round(float(np.median(coherence)), 4),
                          "topics_with_negative_npmi": int(sum(c < 0 for c in coherence)),
                          "diversity_top25": round(len(top25) / (25 * k), 4),
                          "reconstruction_error": round(float(nmf.reconstruction_err_), 2),
                          "fit_seconds": round(time.perf_counter() - start, 1)})
        models[k] = (nmf, coherence)
        print(f"  k={k}: {selection[-1]}", file=sys.stderr)
    best = max(selection, key=lambda s: (s["mean_npmi"], -s["k"]))["k"]
    nmf, coherence = models[best]

    # Topic shares for every corpus paper and the control set.
    x_all = vectorizer.transform(p["text"] for p in papers)
    shares = shares_of(nmf, x_all)
    del x_all
    control = load(args.control)
    control_shares = shares_of(nmf, vectorizer.transform(p["text"] for p in control))
    tau = args.share_threshold
    paper_years = np.array([p["year"] for p in papers], dtype=np.int16)
    control_years = np.array([p["year"] for p in control], dtype=np.int16)

    year_list = sorted(set(int(y) for y in paper_years))
    by_year = np.stack([pair_counts(shares[paper_years == y] >= tau) for y in year_list])
    papers_per_year = np.array([int(((shares[paper_years == y] >= tau).any(axis=1)).sum()) for y in year_list])
    windows = {"old": years(args.old_window), "recent": years(args.recent_window)}
    control_counts, control_totals = {}, {}
    for name, span in windows.items():
        mask = np.isin(control_years, span)
        covered = control_shares[mask] >= tau
        control_counts[name] = pair_counts(covered)
        control_totals[name] = int(covered.any(axis=1).sum())

    # Interpretable description of every topic.
    topics = []
    for t in range(best):
        order = np.argsort(nmf.components_[t])[::-1]
        top_terms = [str(terms[j]) for j in order[:10]]
        representative = np.argsort(shares[:, t])[::-1][:5]
        year_counts = {str(y): int(by_year[i, t, t]) for i, y in enumerate(year_list)}
        topics.append({
            "id": t,
            "label": " · ".join(top_terms[:3]),
            "top_terms": top_terms,
            "npmi": round(coherence[t], 4),
            "papers_by_year": year_counts,
            "representative_papers": [
                {"id": papers[i]["id"], "title": papers[i]["title"], "year": papers[i]["year"],
                 "primary": papers[i]["primary"], "share": round(float(shares[i, t]), 3)} for i in representative],
            "category_mix": dict(Counter(papers[i]["primary"] for i in np.where(shares[:, t] >= tau)[0]).most_common()),
        })

    args.models_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump({
        "vectorizer": vectorizer, "nmf": nmf, "k": best, "share_threshold": tau,
        "shares": shares, "years": year_list, "pair_counts_by_year": by_year, "papers_per_year": papers_per_year,
        "windows": windows, "control_pair_counts": control_counts, "control_papers": control_totals,
        "topics": [{k: v for k, v in t.items() if k in ("id", "label", "top_terms", "npmi")} for t in topics],
    }, args.models_dir / "topics.joblib")
    report = {
        "method": "NMF (scikit-learn, nndsvda initialisation, Frobenius loss) on TF-IDF of words and word pairs",
        "training_papers": len(train), "training_by_category": dict(taken), "reference_papers": len(reference),
        "vocabulary_terms": len(terms), "selection": selection, "chosen_k": best,
        "selection_rule": "highest mean NPMI of the 10 top terms on the held-out reference set (smaller k on ties)",
        "share_threshold": tau, "windows": windows,
        "corpus_papers_covered_per_year": {str(y): int(n) for y, n in zip(year_list, papers_per_year)},
        "control_papers_covered": control_totals,
        "topics": topics,
        "build_seconds": round(time.perf_counter() - t0, 1),
    }
    args.reports_dir.mkdir(parents=True, exist_ok=True)
    (args.reports_dir / "topic_model.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"chosen k={best}; {sum(c < 0 for c in coherence)} topics with negative NPMI", file=sys.stderr)
    for t in topics:
        print(f"  {t['id']:2d} npmi {t['npmi']:+.3f}  {t['label']}", file=sys.stderr)


if __name__ == "__main__":
    main()
