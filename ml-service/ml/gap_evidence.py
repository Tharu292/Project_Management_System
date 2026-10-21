"""Builds the abstract-level evidence store for the aspect-level gap analysis.

Two streaming passes over the raw Cornell arXiv snapshot, restricted to the papers
of the opportunity corpus (same order as models/opportunity/corpus_meta.joblib):

1. collect dataset/benchmark names written in abstracts; keep names (merged by a
   normalised key) that occur in at least --min-dataset-papers papers;
2. for every paper: the aspects its title and abstract mention (curated lists +
   dataset names) and its candidate author statements (future work, under-explored,
   limitations) cut from the ORIGINAL abstract with whitespace normalised.

Every statement is checked to be an exact substring of its whitespace-normalised
original abstract; the build stops if one is not. A sample of original abstracts is
saved (data/gap/quote_check_sample.jsonl, git-ignored) so tests can verify quotes
independently.

Writes models/gap/evidence.joblib (git-ignored) and reports/gap/evidence_store_stats.json.

Usage:
  python -m ml.gap_evidence --input data/raw/arxiv-metadata-oai-snapshot.json
"""

import argparse
import hashlib
import json
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

import joblib
import numpy as np
from scipy import sparse

from ml.gap_aspects import (FAMILIES, LEXICON_VERSION, STATEMENT_TYPES, DatasetLookup, dataset_key, dataset_names,
                            lexicon_aspects,
                            normalise_whitespace, split_sentences, statement_type)
from ml.prepare_data import sampling_key


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--corpus-meta", default=Path("models/opportunity/corpus_meta.joblib"), type=Path)
    parser.add_argument("--models-dir", default=Path("models/gap"), type=Path)
    parser.add_argument("--data-dir", default=Path("data/gap"), type=Path)
    parser.add_argument("--reports-dir", default=Path("reports/gap"), type=Path)
    parser.add_argument("--min-dataset-papers", type=int, default=5)
    parser.add_argument("--quote-sample", type=int, default=300)
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args(argv)


def stream(path, wanted):
    """(row, record) for every snapshot record whose id is in `wanted` (id -> row)."""
    with path.open("rb") as source:
        for raw in source:
            record = json.loads(raw)
            row = wanted.get(str(record.get("id")))
            if row is not None:
                yield row, record


def main(argv=None):
    args = parse_args(argv)
    t0 = time.perf_counter()
    meta = joblib.load(args.corpus_meta)
    ids = meta["ids"]
    wanted = {str(i): r for r, i in enumerate(ids)}
    n = len(ids)

    # Pass 1: dataset vocabulary.
    surfaces, papers_per_key = defaultdict(Counter), Counter()
    for row, record in stream(args.input, wanted):
        names = dataset_names(normalise_whitespace(record.get("abstract")))
        for key in {dataset_key(x) for x in names}:
            papers_per_key[key] += 1
        for name in names:
            surfaces[dataset_key(name)][name] += 1
    keys = sorted(k for k, c in papers_per_key.items() if c >= args.min_dataset_papers and len(k) >= 2)
    print(f"pass 1: {len(papers_per_key):,} dataset keys, {len(keys):,} with >= {args.min_dataset_papers} papers", file=sys.stderr)
    all_surfaces = sorted({s for k in keys for s in surfaces[k]}, key=len, reverse=True)
    surface_key = {s: dataset_key(s) for s in all_surfaces}
    # Surfaces with spaces normalised to single spaces, as produced by the token lookup.
    surface_key = {" ".join(s.split()): k for s, k in surface_key.items()}
    dataset_lookup = DatasetLookup(surface_key)

    columns = [{"family": f, "id": a, "label": entries[a][0]} for f, entries in FAMILIES.items() for a in entries]
    columns += [{"family": "dataset", "id": k, "label": surfaces[k].most_common(1)[0][0]} for k in keys]
    col_index = {(c["family"], c["id"]): i for i, c in enumerate(columns)}

    # Pass 2: aspects and statements.
    rows, cols = [], []
    st_row, st_type, st_text, st_start, st_aspects = [], [], [], [], []
    type_ids = {t: i for i, t in enumerate(STATEMENT_TYPES)}
    quote_rows = set(sorted(range(n), key=lambda r: sampling_key(args.seed, str(ids[r])))[: args.quote_sample])
    quote_sample, verified, seen = [], 0, 0
    for row, record in stream(args.input, wanted):
        seen += 1
        abstract, spans = split_sentences(record.get("abstract"))
        title = normalise_whitespace(record.get("title"))
        found = {col_index[a] for a in lexicon_aspects(f"{title} {abstract}")}
        found |= {col_index[("dataset", surface_key[m])] for m in dataset_lookup.find(f"{title} {abstract}")}
        rows.extend([row] * len(found))
        cols.extend(found)
        for start, end in spans:
            sentence = abstract[start:end]
            kind = statement_type(sentence)
            if kind is None:
                continue
            if sentence not in normalise_whitespace(record.get("abstract")):
                sys.exit(f"quote check failed for {record['id']}")
            verified += 1
            in_sentence = {col_index[a] for a in lexicon_aspects(sentence)}
            in_sentence |= {col_index[("dataset", surface_key[m])] for m in dataset_lookup.find(sentence)}
            st_row.append(row)
            st_type.append(type_ids[kind])
            st_text.append(sentence)
            st_start.append(start)
            st_aspects.append(sorted(in_sentence))
        if row in quote_rows:
            quote_sample.append({"id": record["id"], "abstract": record.get("abstract")})
    if seen != n:
        sys.exit(f"expected {n} corpus papers in the snapshot, found {seen}")

    matrix = sparse.csr_matrix((np.ones(len(rows), dtype=np.int8), (rows, cols)), shape=(n, len(columns)))
    order = np.argsort(np.array(st_row), kind="stable")
    store = {
        "lexicon_version": LEXICON_VERSION,
        "columns": columns,
        "aspect_matrix": matrix,
        "statement_types": list(STATEMENT_TYPES),
        "statements": {
            "row": np.array(st_row, dtype=np.int32)[order],
            "type": np.array(st_type, dtype=np.int8)[order],
            "text": np.array(st_text, dtype=object)[order],
            "start": np.array(st_start, dtype=np.int32)[order],
            "aspects": np.array(st_aspects + [None], dtype=object)[:-1][order],
        },
        "corpus_ids_sha256": hashlib.sha256("\n".join(map(str, ids)).encode()).hexdigest(),
    }
    args.models_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(store, args.models_dir / "evidence.joblib", compress=3)
    args.data_dir.mkdir(parents=True, exist_ok=True)
    with (args.data_dir / "quote_check_sample.jsonl").open("w", encoding="utf-8") as out:
        for item in quote_sample:
            out.write(json.dumps(item, ensure_ascii=False) + "\n")

    papers_with = np.asarray((matrix > 0).sum(axis=0)).ravel()
    type_counts = Counter(st_type)
    stats = {
        "lexicon_version": LEXICON_VERSION,
        "papers": n,
        "aspects": {"total": len(columns), "curated": sum(c["family"] != "dataset" for c in columns),
                    "datasets": len(keys), "min_dataset_papers": args.min_dataset_papers},
        "papers_per_aspect": {f"{c['family']}:{c['label']}": int(papers_with[i]) for i, c in enumerate(columns)
                              if c["family"] != "dataset"},
        "top_datasets": sorted(({"name": columns[i]["label"], "papers": int(papers_with[i])}
                                for i, c in enumerate(columns) if c["family"] == "dataset"),
                               key=lambda d: -d["papers"])[:40],
        "statements": {"total": len(st_row), "verified_exact_substrings": verified,
                       "by_type": {t: int(type_counts[i]) for t, i in type_ids.items()},
                       "papers_with_any": int(len(set(st_row)))},
        "evidence_level": "abstract only (the snapshot contains no full paper text)",
        "build_seconds": round(time.perf_counter() - t0, 1),
    }
    args.reports_dir.mkdir(parents=True, exist_ok=True)
    (args.reports_dir / "evidence_store_stats.json").write_text(json.dumps(stats, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: stats[k] for k in ("aspects", "statements", "build_seconds")}, indent=2), file=sys.stderr)


if __name__ == "__main__":
    main()
