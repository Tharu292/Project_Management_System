"""Builds the research-opportunity corpus from the raw Cornell arXiv snapshot (one streaming pass).

Two document sets are written to data/opportunity/ (git-ignored):

* corpus: every paper whose PRIMARY category is one of the five classifier
  categories, first submitted from --from-year on (the newest, incomplete year
  included, so that recent papers can be retrieved). Same filters as the
  classifier data: abstracts of at least 30 words; papers whose normalised title
  occurs more than once are all dropped.
* control: a hash-ranked sample of papers whose primary category is ANOTHER
  computer-science category (for example cs.LG or cs.AI). It is used only to tell
  "rare in our five-category corpus" apart from "rare in computer science on
  arXiv", i.e. limited dataset coverage versus a possible gap.

Nothing here is synthetic: every record is a real arXiv paper with its real id.

Usage:
  python -m ml.opportunity_corpus --input data/raw/arxiv-metadata-oai-snapshot.json
"""

import argparse
import gzip
import hashlib
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

from ml.prepare_data import DEFAULT_CATEGORIES, first_submission, sampling_key
from ml.text_utils import build_text, normalise_title


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output-dir", default=Path("data/opportunity"), type=Path)
    parser.add_argument("--categories", nargs="+", default=DEFAULT_CATEGORIES)
    parser.add_argument("--from-year", type=int, default=2015)
    parser.add_argument("--control-from-year", type=int, default=2018)
    parser.add_argument("--control-size", type=int, default=120_000)
    parser.add_argument("--min-abstract-words", type=int, default=30)
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args(argv)


def write_jsonl(path, records):
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wt", encoding="utf-8") as out:
        for record in records:
            out.write(json.dumps(record, ensure_ascii=False) + "\n")


def main(argv=None):
    args = parse_args(argv)
    if not args.input.is_file():
        sys.exit(f"Dataset not found: {args.input}")
    selected = set(args.categories)
    file_hash = hashlib.sha256()
    corpus, control, stats = [], [], Counter()
    latest = None
    with args.input.open("rb") as source:
        for raw in source:
            file_hash.update(raw)
            stats["records"] += 1
            if stats["records"] % 500_000 == 0:
                print(f"  read {stats['records']:,} records", file=sys.stderr)
            record = json.loads(raw)
            categories = (record.get("categories") or "").split()
            if not categories or not categories[0].startswith("cs."):
                continue
            submitted = first_submission(record)
            if submitted is None:
                continue
            latest = submitted if latest is None or submitted > latest else latest
            primary, year = categories[0], submitted.year
            in_corpus = primary in selected and year >= args.from_year
            in_control = primary not in selected and year >= args.control_from_year
            if not (in_corpus or in_control):
                continue
            text = build_text(record.get("title"), record.get("abstract"))
            if len(text.split()) < args.min_abstract_words:
                stats["dropped_short"] += 1
                continue
            item = {"id": str(record["id"]), "title": " ".join((record.get("title") or "").split()),
                    "year": year, "primary": primary, "categories": categories, "text": text}
            (corpus if in_corpus else control).append(item)

    # Duplicate titles: every copy is dropped (same rule as the classifier data).
    title_counts = Counter(normalise_title(p["title"]) for p in corpus)
    before = len(corpus)
    corpus = [p for p in corpus if title_counts[normalise_title(p["title"])] == 1]
    stats["dropped_duplicate_titles"] = before - len(corpus)
    corpus.sort(key=lambda p: p["id"])

    control.sort(key=lambda p: sampling_key(args.seed, p["id"]))
    control_eligible = len(control)
    control = sorted(control[: args.control_size], key=lambda p: p["id"])

    write_jsonl(args.output_dir / "corpus.jsonl.gz", corpus)
    write_jsonl(args.output_dir / "control.jsonl.gz", control)
    by_year = defaultdict(Counter)
    for p in corpus:
        by_year[p["primary"]][p["year"]] += 1
    manifest = {
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "dataset": {"file": args.input.name, "sha256": file_hash.hexdigest(), "records": stats["records"],
                    "latest_submission": latest.date().isoformat() if latest else None},
        "parameters": vars(args) | {"input": args.input.name, "output_dir": str(args.output_dir)},
        "corpus": {"papers": len(corpus), "by_category": dict(Counter(p["primary"] for p in corpus)),
                   "by_category_and_year": {c: dict(sorted(v.items())) for c, v in by_year.items()},
                   "dropped_duplicate_titles": stats["dropped_duplicate_titles"]},
        "control": {"papers": len(control), "eligible": control_eligible,
                    "by_category": dict(Counter(p["primary"] for p in control).most_common(15)),
                    "sampling": "N smallest sha256('<seed>:<arxiv id>') among other cs.* primary categories"},
        "dropped_short_abstracts": stats["dropped_short"],
    }
    (args.output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, default=str) + "\n", encoding="utf-8")
    print(f"corpus: {len(corpus):,} papers | control: {len(control):,} of {control_eligible:,} eligible", file=sys.stderr)


if __name__ == "__main__":
    main()
