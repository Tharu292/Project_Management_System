"""Builds a reproducible, labelled sample of real arXiv papers for topic classification.

Input: the Cornell arXiv metadata snapshot from Kaggle
(arxiv-metadata-oai-snapshot.json, one JSON record per line). The file is
streamed line by line, so its size does not matter for memory.

Label policy (see docs/dataset.md):
  * the label is the paper's primary category, the FIRST entry of "categories";
  * a paper is kept only when that primary category is one of the selected ones;
  * the year is taken from the first version's submission date.

Sampling is deterministic: every candidate gets the key sha256("<seed>:<id>")
and the N smallest keys per category are taken, so the same snapshot and seed
always give the same sample, whatever order the file is read in.

Usage:
  python -m ml.prepare_data --input data/raw/arxiv-metadata-oai-snapshot.json
"""

import argparse
import gzip
import hashlib
import io
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

from ml.text_utils import clean_text, normalise_title

DEFAULT_CATEGORIES = ["cs.CV", "cs.CL", "cs.CR", "cs.RO", "cs.DB"]
LABEL_POLICY = (
    "Label = primary arXiv category = first entry of the 'categories' field. "
    "Only papers whose primary category is one of the selected categories are kept. "
    "Cross-listed papers are kept and labelled by their primary category."
)


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input", required=True, type=Path, help="arxiv-metadata-oai-snapshot.json")
    parser.add_argument("--output-dir", default=Path("data/processed"), type=Path)
    parser.add_argument("--categories", nargs="+", default=DEFAULT_CATEGORIES)
    parser.add_argument("--per-category", type=int, default=2000)
    parser.add_argument("--years", default="2018-2024", help="inclusive range of first-submission years")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--min-abstract-words", type=int, default=30,
        help="shorter abstracts are dropped (this removes most 'paper withdrawn' notices)",
    )
    args = parser.parse_args(argv)
    first, _, last = args.years.partition("-")
    args.year_from, args.year_to = int(first), int(last or first)
    if args.year_from > args.year_to:
        parser.error("--years must be FROM-TO with FROM <= TO")
    if len(set(args.categories)) != len(args.categories):
        parser.error("--categories contains duplicates")
    return args


def first_submission(record):
    versions = record.get("versions") or []
    if not versions or not versions[0].get("created"):
        return None
    try:
        return parsedate_to_datetime(versions[0]["created"]).astimezone(timezone.utc)
    except (TypeError, ValueError):
        return None


def sampling_key(seed, arxiv_id):
    return hashlib.sha256(f"{seed}:{arxiv_id}".encode("utf-8")).hexdigest()


def read_candidates(args, stats):
    """One streaming pass: hashes the whole file and collects papers that pass the filters."""
    selected = set(args.categories)
    file_hash = hashlib.sha256()
    candidates = []
    with args.input.open("rb") as source:
        for raw_line in source:
            file_hash.update(raw_line)
            stats["lines_read"] += 1
            if stats["lines_read"] % 500_000 == 0:
                print(f"  read {stats['lines_read']:,} records, {len(candidates):,} candidates", file=sys.stderr)
            try:
                record = json.loads(raw_line)
            except json.JSONDecodeError:
                stats["malformed_lines"] += 1
                continue

            categories = (record.get("categories") or "").split()
            if not categories or categories[0] not in selected:
                continue
            submitted = first_submission(record)
            if submitted is None:
                stats["dropped_missing_date"] += 1
                continue
            if not args.year_from <= submitted.year <= args.year_to:
                continue
            title = clean_text(record.get("title"))
            abstract = clean_text(record.get("abstract"))
            if not title or len(abstract.split()) < args.min_abstract_words:
                stats["dropped_short_or_empty"] += 1
                continue

            candidates.append({
                "id": str(record.get("id", "")).strip(),
                "label": categories[0],
                "categories": categories,
                "submitted": submitted.date().isoformat(),
                "year": submitted.year,
                "title": title,
                "abstract": abstract,
            })
    return candidates, file_hash.hexdigest()


def remove_duplicates(candidates, stats):
    """Keeps one record per id; drops EVERY record whose normalised title occurs more than once."""
    by_id = {}
    for paper in candidates:
        if not paper["id"] or paper["id"] in by_id:
            stats["dropped_duplicate_id"] += 1
            continue
        by_id[paper["id"]] = paper
    title_counts = Counter(normalise_title(p["title"]) for p in by_id.values())
    unique = []
    for paper in by_id.values():
        if title_counts[normalise_title(paper["title"])] > 1:
            stats["dropped_duplicate_title"] += 1
            continue
        unique.append(paper)
    return unique


def select_sample(papers, args):
    by_label = defaultdict(list)
    for paper in papers:
        by_label[paper["label"]].append(paper)
    sample = []
    for label in args.categories:
        ranked = sorted(by_label[label], key=lambda p: sampling_key(args.seed, p["id"]))
        sample.extend(ranked[: args.per_category])
    return sorted(sample, key=lambda p: p["id"]), {label: len(by_label[label]) for label in args.categories}


def write_sample(sample, path):
    """Writes gzip-compressed JSON lines with a fixed header timestamp; returns the SHA-256 of the content."""
    content_hash = hashlib.sha256()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as raw, gzip.GzipFile(fileobj=raw, mode="wb", mtime=0) as compressed:
        with io.TextIOWrapper(compressed, encoding="utf-8", newline="\n") as out:
            for paper in sample:
                line = json.dumps(paper, ensure_ascii=False, sort_keys=True) + "\n"
                content_hash.update(line.encode("utf-8"))
                out.write(line)
    return content_hash.hexdigest()


def main(argv=None):
    args = parse_args(argv)
    if not args.input.is_file():
        sys.exit(f"Dataset not found: {args.input}\nSee docs/dataset.md for how to download it.")

    started = datetime.now(timezone.utc)
    stats = Counter()
    print(f"Reading {args.input} ...", file=sys.stderr)
    candidates, dataset_sha256 = read_candidates(args, stats)
    unique = remove_duplicates(candidates, stats)
    sample, available = select_sample(unique, args)

    sample_path = args.output_dir / "sample.jsonl.gz"
    sample_sha256 = write_sample(sample, sample_path)

    selected_counts = Counter(p["label"] for p in sample)
    by_year = defaultdict(Counter)
    for paper in sample:
        by_year[paper["label"]][paper["year"]] += 1
    selected = set(args.categories)
    cross_listed = sum(len(p["categories"]) > 1 for p in sample)
    cross_listed_within = sum(any(c in selected for c in p["categories"][1:]) for p in sample)
    shortfalls = {label: available[label] for label in args.categories if available[label] < args.per_category}

    manifest = {
        "created_at": started.isoformat(timespec="seconds"),
        "dataset": {
            "file": args.input.name,
            "size_bytes": args.input.stat().st_size,
            "sha256": dataset_sha256,
            "records_read": stats["lines_read"],
            "malformed_lines": stats["malformed_lines"],
        },
        "parameters": {
            "categories": args.categories,
            "per_category": args.per_category,
            "years": [args.year_from, args.year_to],
            "seed": args.seed,
            "min_abstract_words": args.min_abstract_words,
            "sampling": "N smallest sha256('<seed>:<arxiv id>') per category",
        },
        "label_policy": LABEL_POLICY,
        "filtering": {
            "dropped_missing_date": stats["dropped_missing_date"],
            "dropped_short_or_empty": stats["dropped_short_or_empty"],
            "dropped_duplicate_id": stats["dropped_duplicate_id"],
            "dropped_duplicate_title": stats["dropped_duplicate_title"],
            "eligible_by_category": available,
        },
        "sample": {
            "file": sample_path.as_posix(),
            "content_sha256": sample_sha256,
            "total": len(sample),
            "by_category": {label: selected_counts[label] for label in args.categories},
            "by_category_and_year": {
                label: {str(year): n for year, n in sorted(by_year[label].items())} for label in args.categories
            },
            "cross_listed_share": round(cross_listed / len(sample), 4) if sample else 0.0,
            "cross_listed_within_selected_share": round(cross_listed_within / len(sample), 4) if sample else 0.0,
            "categories_below_target": shortfalls,
        },
    }
    manifest_path = args.output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    print(f"Wrote {len(sample):,} papers to {sample_path}", file=sys.stderr)
    print(f"Manifest: {manifest_path}", file=sys.stderr)
    for label in args.categories:
        print(f"  {label}: {selected_counts[label]:,} selected of {available[label]:,} eligible", file=sys.stderr)
    if shortfalls:
        print(f"WARNING: fewer eligible papers than requested for {sorted(shortfalls)}", file=sys.stderr)


if __name__ == "__main__":
    main()
