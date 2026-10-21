"""Generates the manual review sheets for the aspect-level gap analysis (labels left blank).

Writes reports/gap/review/:
  a_statements.csv      ~200 author statements, stratified by predicted type
  b_datasets.csv         100 (paper, dataset name) matches with context
  c_aspects.csv          100 (paper, curated aspect) matches with the matched text
  d_case_studies.csv     the displayed potential gaps for 8 held-out 2026 papers
  e_recall_sentences.csv 300 random abstract sentences with the predicted type (or none)
  case_studies.json      the full analyses behind sheet d
  review_status.json     what to label and how (no metrics: those come from ml.gap_metrics)

All samples are hash-ranked with a fixed seed, so the sheets are reproducible.

Usage:
  python -m ml.gap_review --input data/raw/arxiv-metadata-oai-snapshot.json
"""

import argparse
import csv
import gzip
import json
import sys
from collections import defaultdict
from pathlib import Path

from ml.gap_analysis import GapAnalyzer
from ml.gap_aspects import STATEMENT_TYPES, lexicon_matcher, normalise_whitespace, split_sentences, statement_type
from ml.gap_metrics import compute
from ml.opportunity import OpportunityEngine
from ml.prepare_data import sampling_key

PER_TYPE = {"future_work": 35, "under_explored": 35, "limitation_own": 35, "limitation_evaluated": 35,
            "limitation_prior": 30, "limitation_unclear": 25, "limitation_addressed": 30}
TYPE_CHOICES = "|".join(list(STATEMENT_TYPES) + ["none"])


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--corpus", default=Path("data/opportunity/corpus.jsonl.gz"), type=Path)
    parser.add_argument("--opportunity-dir", default=Path("models/opportunity"), type=Path)
    parser.add_argument("--gap-dir", default=Path("models/gap"), type=Path)
    parser.add_argument("--out", default=Path("reports/gap/review"), type=Path)
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args(argv)


def write(path, header, rows):
    with path.open("w", newline="", encoding="utf-8") as out:
        writer = csv.writer(out)
        writer.writerow(header)
        writer.writerows(rows)


def ranked(items, seed, key):
    return sorted(items, key=lambda x: sampling_key(seed, key(x)))


def main(argv=None):
    args = parse_args(argv)
    if args.out.is_dir():
        labelled, _ = compute(args.out)
        if labelled:
            sys.exit(f"{args.out} already contains manual labels; refusing to overwrite them. Use another --out.")
    engine = OpportunityEngine(args.opportunity_dir)
    analyser = GapAnalyzer(engine, args.gap_dir)
    ids, titles = engine.ids, engine.titles
    st = analyser.statements
    types = analyser.statement_types
    args.out.mkdir(parents=True, exist_ok=True)
    url = "https://arxiv.org/abs/"

    # (a) statements, stratified by type.
    by_type = defaultdict(list)
    for s in range(len(st["row"])):
        by_type[types[int(st["type"][s])]].append(s)
    rows = []
    for kind, n in PER_TYPE.items():
        for s in ranked(by_type[kind], args.seed, lambda s: f"{ids[st['row'][s]]}:{st['start'][s]}")[:n]:
            r = int(st["row"][s])
            rows.append([f"A{len(rows) + 1:03d}", ids[r], url + ids[r], titles[r], kind, st["text"][s], "", "", "", ""])
    write(args.out / "a_statements.csv",
          ["item", "arxiv_id", "url", "title", "predicted_type", "quote", "label_type_correct_yes_no",
           f"label_true_type ({TYPE_CHOICES})", "label_quote_is_exact_yes_no", "notes"], rows)

    # Papers needed for context in sheets b, c and e: one pass over the snapshot.
    matrix = analyser.matrix_rows
    dataset_cols = {i for i, c in enumerate(analyser.columns) if c["family"] == "dataset"}
    coo = matrix.tocoo()
    pairs_d = [(int(r), int(c)) for r, c in zip(coo.row, coo.col) if c in dataset_cols]
    pairs_c = [(int(r), int(c)) for r, c in zip(coo.row, coo.col) if c not in dataset_cols]
    sample_d = ranked(pairs_d, args.seed + 1, lambda p: f"{ids[p[0]]}:{p[1]}")[:100]
    sample_c = ranked(pairs_c, args.seed + 2, lambda p: f"{ids[p[0]]}:{p[1]}")[:100]
    recall_rows = ranked(range(len(ids)), args.seed + 3, lambda r: str(ids[r]))[:300]
    needed = {ids[r] for r, _ in sample_d} | {ids[r] for r, _ in sample_c} | {ids[r] for r in recall_rows}
    abstracts = {}
    with args.input.open("rb") as source:
        for raw in source:
            record = json.loads(raw)
            if record.get("id") in needed:
                abstracts[record["id"]] = (normalise_whitespace(record.get("title")), normalise_whitespace(record.get("abstract")))
    print(f"context abstracts: {len(abstracts)} of {len(needed)}", file=sys.stderr)

    def context(text, needle, width=110):
        at = text.find(needle)
        if at < 0:
            return ""
        return ("…" if at > width else "") + text[max(0, at - width): at + len(needle) + width] + "…"

    rows = []
    for r, c in sample_d:
        title, abstract = abstracts.get(ids[r], ("", ""))
        name = analyser.columns[c]["label"]
        rows.append([f"B{len(rows) + 1:03d}", ids[r], url + ids[r], name, context(f"{title} {abstract}", name), "", ""])
    write(args.out / "b_datasets.csv", ["item", "arxiv_id", "url", "dataset_name", "context",
                                        "label_is_a_dataset_or_benchmark_yes_no", "notes"], rows)

    matchers = lexicon_matcher()
    rows = []
    for r, c in sample_c:
        title, abstract = abstracts.get(ids[r], ("", ""))
        col = analyser.columns[c]
        text = f"{title} {abstract}"
        matched = ""
        for m in matchers[col["family"]].finditer(text):
            if m.lastgroup == f"{col['family']}__{col['id']}":
                matched = m.group(0)
                break
        rows.append([f"C{len(rows) + 1:03d}", ids[r], url + ids[r], col["family"], col["label"], matched,
                     context(text, matched) if matched else "", "", ""])
    write(args.out / "c_aspects.csv", ["item", "arxiv_id", "url", "family", "aspect", "matched_text", "context",
                                       "label_paper_really_concerns_this_aspect_yes_no", "notes"], rows)

    rows = []
    for r in recall_rows:
        _, abstract = abstracts.get(ids[r], ("", ""))
        text, spans = split_sentences(abstract)
        if not spans:
            continue
        a, b = spans[int(sampling_key(args.seed + 4, ids[r])[:8], 16) % len(spans)]
        sentence = text[a:b]
        rows.append([f"E{len(rows) + 1:03d}", ids[r], url + ids[r], sentence, statement_type(sentence) or "none", ""])
    write(args.out / "e_recall_sentences.csv",
          ["item", "arxiv_id", "url", "sentence", "predicted_type", f"label_true_type ({TYPE_CHOICES})"], rows)

    # (d) case studies on held-out 2026 papers, each excluded from its own evidence.
    with gzip.open(args.corpus, "rt", encoding="utf-8") as source:
        pool = [json.loads(line) for line in source]
    pool = [p for p in pool if p["year"] == 2026]
    cases, rows = [], []
    for paper in ranked(pool, args.seed + 5, lambda p: p["id"])[:8]:
        title = paper["title"]
        abstract = paper["text"][len(title):].strip() if paper["text"].startswith(title) else paper["text"]
        result = analyser.analyse(title, abstract, exclude_id=paper["id"])
        cases.append({"query": {"arxivId": paper["id"], "title": title, "url": url + paper["id"]}, "result": result})
        # One row per displayed potential gap: what the student sees in "Potential Research Gaps Identified".
        for g in result["potentialGaps"]:
            quotes = " || ".join(f"[{q['paper']['arxivId']}, {q['paper']['year']}, {q['type']}] {q['quote']}"
                                 for q in g["statements"][:2])
            rows.append([f"D{len(rows) + 1:03d}", paper["id"], title, "potential_gap", g["uncertainty"], g["heading"],
                         "+".join(g["signals"]), f"{g['paperCount']} papers", g["explanation"], quotes,
                         " | ".join(g["notes"]), "", ""])
    write(args.out / "d_case_studies.csv",
          ["item", "query_arxiv_id", "query_title", "finding_kind", "uncertainty", "heading", "signals", "evidence_counts",
           "explanation", "quotes", "cautions", "label_judgement (supported|plausible|not_supported|unsure)", "notes"], rows)
    (args.out / "case_studies.json").write_text(json.dumps(cases, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")

    status = {
        "labelled": False,
        "status": "No manual labels yet: extraction precision, recall and gap-identification accuracy are NOT measured.",
        "sheets": {name: sum(1 for _ in open(args.out / name, encoding="utf-8")) - 1
                   for name in ("a_statements.csv", "b_datasets.csv", "c_aspects.csv", "d_case_studies.csv",
                                "e_recall_sentences.csv")},
        "how_to_label": {
            "a_statements.csv": "Is the predicted type right? If not, give the true type. Check the quote against the arXiv page.",
            "b_datasets.csv": "Is the name a dataset or benchmark (not a method, language or organisation)?",
            "c_aspects.csv": "Does the paper really concern this aspect, judging from the matched text in context?",
            "d_case_studies.csv": "Is each displayed potential gap relevant to the query paper and supported by the evidence "
                                  "shown: supported, plausible, not_supported or unsure?",
            "e_recall_sentences.csv": "What is the sentence's true type (or none)? Used to estimate recall.",
        },
        "then_run": "python -m ml.gap_metrics",
        "sampling": "hash-ranked with fixed seeds; case-study papers are excluded from their own evidence",
    }
    (args.out / "review_status.json").write_text(json.dumps(status, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(status["sheets"]), file=sys.stderr)


if __name__ == "__main__":
    main()
