"""Historical research-trend analysis on the full arXiv snapshot (descriptive statistics only).

For the selected categories it measures, from every paper in the snapshot:
  * annual publication counts (by primary category, and by any listing);
  * each category's share of all papers whose primary category is computer science;
  * growth since a base year (index and compound annual growth rate);
  * keyword trends: the share of a category's papers whose title or abstract
    contains a term, per year, and the terms whose share rose or fell most between
    a base period and the most recent full years.

This describes what has been published on arXiv. It does not forecast, and it does
not detect research gaps: a rising keyword means more papers mention it, not that
the topic is under-researched.

The year of a paper is the year of its first version. The newest year in the
snapshot is incomplete; it is kept in the CSV (flagged) but left out of growth
figures, keyword periods and charts.

Usage:
  python -m ml.trends --input data/raw/arxiv-metadata-oai-snapshot.json
"""

import argparse
import csv
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS, CountVectorizer

from ml import plot_style as style
from ml.prepare_data import DEFAULT_CATEGORIES, first_submission, sampling_key
from ml.text_utils import build_text

plt = style.plt


def year_list(text):
    """"2018-2019" -> [2018, 2019]; "2020" -> [2020]."""
    first, _, last = text.partition("-")
    return list(range(int(first), int(last or first) + 1))


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input", required=True, type=Path, help="arxiv-metadata-oai-snapshot.json")
    parser.add_argument("--categories", nargs="+", default=DEFAULT_CATEGORIES)
    parser.add_argument("--from-year", type=int, default=2010, help="first year of the publication counts")
    parser.add_argument("--index-base-year", type=int, default=2018, help="growth is measured from this year")
    parser.add_argument("--keyword-from-year", type=int, default=2015)
    parser.add_argument("--base-years", default="2018-2019", help="keyword comparison: earlier period")
    parser.add_argument("--recent-years", default=None,
                        help="keyword comparison: recent period (default: the last two full years)")
    parser.add_argument("--min-share", type=float, default=0.02,
                        help="a rising term must appear in at least this share of recent papers "
                             "(a falling term: of base-period papers)")
    parser.add_argument("--top-k", type=int, default=10)
    parser.add_argument("--vocab-sample", type=int, default=40_000,
                        help="papers per category (hash-ranked) used to build the keyword vocabulary")
    parser.add_argument("--min-df", type=int, default=10, help="minimum papers in the vocabulary sample")
    parser.add_argument("--min-abstract-words", type=int, default=30)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output-dir", default=Path("reports/trends"), type=Path)
    parser.add_argument("--figures-dir", default=Path("reports/figures"), type=Path)
    return parser.parse_args(argv)


def scan(args):
    """One streaming pass over the snapshot."""
    selected = set(args.categories)
    file_hash = hashlib.sha256()
    all_total, cs_primary = Counter(), Counter()
    primary_counts, any_counts = defaultdict(Counter), defaultdict(Counter)
    texts = defaultdict(list)
    latest, stats = None, Counter()
    with args.input.open("rb") as source:
        for raw_line in source:
            file_hash.update(raw_line)
            stats["records"] += 1
            if stats["records"] % 500_000 == 0:
                print(f"  read {stats['records']:,} records", file=sys.stderr)
            try:
                record = json.loads(raw_line)
            except json.JSONDecodeError:
                stats["malformed"] += 1
                continue
            submitted = first_submission(record)
            if submitted is None:
                stats["missing_date"] += 1
                continue
            year = submitted.year
            latest = submitted if latest is None or submitted > latest else latest
            all_total[year] += 1
            categories = (record.get("categories") or "").split()
            if not categories:
                continue
            primary = categories[0]
            if primary.startswith("cs."):
                cs_primary[year] += 1
            for category in selected.intersection(categories):
                any_counts[category][year] += 1
            if primary not in selected:
                continue
            primary_counts[primary][year] += 1
            if year >= args.keyword_from_year:
                text = build_text(record.get("title"), record.get("abstract"))
                if len(text.split()) >= args.min_abstract_words:
                    texts[primary].append((year, str(record.get("id")), text))
    return {
        "sha256": file_hash.hexdigest(), "stats": stats, "latest": latest, "all_total": all_total,
        "cs_primary": cs_primary, "primary": primary_counts, "any": any_counts, "texts": texts,
    }


SAME_CONCEPT_JACCARD = 0.5

# Keyword analysis only (the classifier is unaffected). Links to code and project pages
# ("github.com/...", "...github.io") are not research topics, so URLs are removed.
_URL = re.compile(r"https?://\S+|www\.\S+|\b\S+\.(?:com|io|org|net)\b\S*")
# A small, manually chosen list of academic boilerplate added to the standard English
# stop words. These words carry no topic; their shares mostly track writing style.
ACADEMIC_STOP_WORDS = {
    "able", "al", "approach", "approaches", "based", "big", "consideration", "describes", "enhancing", "et",
    "good", "having", "huge", "interesting", "method", "methods", "new", "novel", "order", "paper", "people",
    "possible", "present", "presented", "propose", "proposed", "respect", "results", "show", "shows",
    "struggle", "study", "taking", "use", "used", "using", "work", "github", "https", "http", "website", "com",
    "io", "www",
}


def keyword_preprocess(text):
    return _URL.sub(" ", text.lower())


def word_set(term):
    """Words of a term with a plural "s" and a "-based" suffix removed, so "llms", "llm" and "llm-based" compare equal."""
    words = {w.removesuffix("-based") for w in term.split()}
    return {w[:-1] if w.endswith("s") and len(w) > 3 else w for w in words}


def merge_same_concept(candidates, papers_with, k):
    """Walks candidates best-first and keeps the first k distinct concepts.

    A candidate is folded into a kept term (and listed under its "similar_terms")
    when its words are a subset or superset of the kept term's, ignoring plurals,
    or when the two terms occur mostly in the same papers (Jaccard >= 0.5), as
    "large language" and "language models" do.
    """
    kept = []
    for term in candidates:
        words, docs = word_set(term["term"]), papers_with(term["_j"])
        for concept in kept:
            # Compared with every term already in the concept, so "llm" joins via "llms".
            same_words = any(words <= w or w <= words for w in concept["_word_sets"])
            union = len(docs | concept["_docs"])
            if same_words or (union and len(docs & concept["_docs"]) / union >= SAME_CONCEPT_JACCARD):
                concept["similar_terms"].append(term["term"])
                concept["similar_shares"][term["term"]] = (term["base_share"], term["recent_share"])
                concept["_word_sets"].append(words)
                concept["_docs"] |= docs
                break
        else:
            if len(kept) == k:
                break
            kept.append({**term, "_docs": docs, "_word_sets": [words], "similar_terms": [], "similar_shares": {}})
    for concept in kept:
        del concept["_docs"], concept["_word_sets"], concept["_j"]
    return kept


def keyword_trends(texts, years, base_years, recent_years, args):
    """Per-year document share of every vocabulary term, and the terms that rose or fell most."""
    docs = [(y, i, t) for (y, i, t) in texts if years[0] <= y <= years[-1]]
    vocab_docs = sorted(docs, key=lambda d: sampling_key(args.seed, d[1]))[: args.vocab_sample]
    vectorizer = CountVectorizer(
        binary=True, ngram_range=(1, 2), min_df=args.min_df, strip_accents="unicode",
        stop_words=sorted(ENGLISH_STOP_WORDS | ACADEMIC_STOP_WORDS), preprocessor=keyword_preprocess,
        token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*\b", dtype=np.int32,
    )
    vectorizer.fit([d[2] for d in vocab_docs])
    X = vectorizer.transform([d[2] for d in docs]).tocsr()
    doc_years = np.array([d[0] for d in docs])
    terms = vectorizer.get_feature_names_out()

    n_by_year = np.array([(doc_years == y).sum() for y in years])
    df_by_year = np.vstack([np.asarray(X[doc_years == y].sum(axis=0)).ravel() for y in years])
    share = df_by_year / n_by_year[:, None]
    index = {y: i for i, y in enumerate(years)}
    base = share[[index[y] for y in base_years]].mean(axis=0)
    recent = share[[index[y] for y in recent_years]].mean(axis=0)
    eps = 0.002  # smoothing, so a term that was absent does not get an infinite ratio
    log_ratio = np.log((recent + eps) / (base + eps))

    def ranked(mask, order, period):
        rows = [{"term": terms[j], "base_share": float(base[j]), "recent_share": float(recent[j]),
                 "change_pp": float((recent[j] - base[j]) * 100), "log_ratio": float(log_ratio[j]), "_j": int(j)}
                for j in np.flatnonzero(mask)]
        # Same-concept checks use the papers of the period in which the terms are common.
        in_period = X[np.isin(doc_years, period)].tocsc()

        def papers_with(j):
            return set(in_period.indices[in_period.indptr[j]:in_period.indptr[j + 1]].tolist())

        return merge_same_concept(sorted(rows, key=order), papers_with, args.top_k)

    rising = ranked((recent >= args.min_share) & (log_ratio > 0), lambda r: -r["log_ratio"], recent_years)
    falling = ranked((base >= args.min_share) & (log_ratio < 0), lambda r: r["log_ratio"], base_years)
    column = {t: j for j, t in enumerate(terms)}
    series = {r["term"]: {"doc_count": df_by_year[:, column[r["term"]]], "share": share[:, column[r["term"]]]}
              for r in rising + falling}
    return {"n_by_year": n_by_year, "vocabulary_size": len(terms), "rising": rising, "falling": falling,
            "series": series}


def write_csv(path, header, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as out:
        writer = csv.writer(out)
        writer.writerow(header)
        writer.writerows(rows)


# ---------------------------------------------------------------- figures

def category_legend(ax, categories, **kwargs):
    handles = [plt.Line2D([], [], color=style.CATEGORY_COLORS[c], linewidth=2.2,
                          label=f"{c}  {style.CATEGORY_NAMES[c]}") for c in categories]
    ax.legend(handles=handles, **kwargs)


def figure_counts(path, years, categories, primary, last_full, latest, note):
    fig, ax = plt.subplots(figsize=(12, 6.2))
    order = sorted(categories, key=lambda c: -primary[c][last_full])
    labels = []
    for c in order:
        values = [primary[c][y] for y in years]
        ax.plot(years, values, color=style.CATEGORY_COLORS[c])
        style.end_marker(ax, years[-1], values[-1], style.CATEGORY_COLORS[c])
        labels.append((values[-1], f"{values[-1]:,}", c))
    ax.yaxis.set_major_formatter(style.COMPACT)
    ax.set_xticks(years[::2] if len(years) > 10 else years)
    ax.set_xlim(years[0] - 0.3, years[-1] + 1.0)
    ax.set_ylim(bottom=0)
    style.end_labels(ax, labels, years[-1])
    ax.set_ylabel("Papers per year")
    ax.set_title("arXiv papers per year, by primary category", pad=26)
    style.subtitle(ax, f"First-version submissions, {years[0]}–{last_full}. "
                       f"{latest.year} is incomplete (snapshot ends {latest.date().isoformat()}) and not shown.")
    category_legend(ax, order, loc="upper left")
    style.source_note(fig, note)
    style.save(fig, path)


def figure_index(path, years, categories, primary, base_year, last_full, note):
    fig, ax = plt.subplots(figsize=(12, 6.2))
    ax.axhline(100, color=style.AXIS, linewidth=1)
    order = sorted(categories, key=lambda c: -primary[c][last_full] / max(primary[c][base_year], 1))
    labels = []
    for c in order:
        values = [100 * primary[c][y] / primary[c][base_year] for y in years]
        ax.plot(years, values, color=style.CATEGORY_COLORS[c])
        style.end_marker(ax, years[-1], values[-1], style.CATEGORY_COLORS[c])
        labels.append((values[-1], f"×{values[-1] / 100:.1f}", c))
    ax.set_xticks(years)
    ax.set_xlim(years[0] - 0.2, years[-1] + 0.7)
    ax.set_ylim(bottom=0)
    style.end_labels(ax, labels, years[-1])
    ax.set_ylabel(f"Index ({base_year} = 100)")
    ax.set_title(f"Growth since {base_year}: papers per year relative to {base_year}", pad=26)
    style.subtitle(ax, "Each category on a common base, so small and large categories can be compared. "
                       "End labels: growth multiple.")
    category_legend(ax, order, loc="upper left")
    style.source_note(fig, note)
    style.save(fig, path)


def figure_share(path, years, categories, primary, cs_primary, last_full, note):
    fig, ax = plt.subplots(figsize=(12, 6.2))
    order = sorted(categories, key=lambda c: -primary[c][last_full] / cs_primary[last_full])
    labels = []
    for c in order:
        values = [primary[c][y] / cs_primary[y] for y in years]
        ax.plot(years, values, color=style.CATEGORY_COLORS[c])
        style.end_marker(ax, years[-1], values[-1], style.CATEGORY_COLORS[c])
        labels.append((values[-1], f"{values[-1]:.1%}", c))
    ax.yaxis.set_major_formatter(style.PERCENT)
    ax.set_xticks(years[::2] if len(years) > 10 else years)
    ax.set_xlim(years[0] - 0.3, years[-1] + 1.0)
    ax.set_ylim(bottom=0)
    style.end_labels(ax, labels, years[-1])
    ax.set_ylabel("Share of all CS papers")
    ax.set_title("Share of all computer-science papers (primary category)", pad=26)
    style.subtitle(ax, f"Category papers ÷ all papers whose primary category is cs.*, {years[0]}–{last_full}.")
    category_legend(ax, order, loc="upper left")
    style.source_note(fig, note)
    style.save(fig, path)


def display_label(term, coverage=0.8):
    """A readable name for a measured term, repairing bigram fragments.

    "large language" + "language models" -> "large language models". The longer phrase is used
    only when it occurs in at least `coverage` of the papers the measured term occurs in (in the
    period where the term is common), so a label never names a narrower topic than the one
    measured: "prompt" is not relabelled "prompt injection".
    """
    label = term["term"]
    period = 1 if term["log_ratio"] > 0 else 0  # rising terms: recent period; falling: base period
    measured = (term["base_share"], term["recent_share"])[period]
    for similar in term["similar_terms"]:
        if term["similar_shares"][similar][period] < coverage * measured:
            continue
        if similar.startswith(label + " "):
            return similar
        first, _, rest = similar.partition(" ")
        if rest and label.split()[-1] == first:
            return f"{label} {rest}"
    return label


def figure_keywords(path, years, categories, results, base_years, recent_years, note, per_panel=3):
    fig, axes = plt.subplots(2, 3, figsize=(15, 8.4), sharex=True)
    for ax, c in zip(axes.flat, categories):
        rising = results[c]["rising"][:per_panel]
        for color, term in zip(style.SERIES, rising):
            values = results[c]["series"][term["term"]]["share"]
            ax.plot(years, values, color=color, label=display_label(term))
            style.end_marker(ax, years[-1], values[-1], color)
        ax.yaxis.set_major_formatter(style.PERCENT)
        ax.set_ylim(bottom=0)
        ax.set_title(f"{c}  {style.CATEGORY_NAMES[c]}", fontsize=12)
        ax.legend(loc="upper left", fontsize=10, handlelength=1.4)
        ax.tick_params(axis="x", labelrotation=0, labelsize=9)
    last = axes.flat[len(categories)]
    last.axis("off")
    last.text(0, 0.95,
              "How to read this\n\n"
              "Each line is the share of that category's papers\n"
              "whose title or abstract contains the term.\n\n"
              f"Terms shown: the 3 with the largest rise from\n"
              f"{base_years[0]}–{base_years[-1]} to {recent_years[0]}–{recent_years[-1]}, among terms in at least\n"
              "2% of recent papers. Variants of one concept\n"
              "(e.g. \"llms\" / \"large language\") are ranked once;\n"
              "each line counts the term named in its legend.\n\n"
              "A rising keyword means more papers mention it.\n"
              "It is not, on its own, evidence of a research gap.",
              va="top", ha="left", color=style.INK_SECONDARY, fontsize=10.5, transform=last.transAxes)
    for ax in axes.flat:
        ax.set_xticks(years[::2])
    fig.suptitle(f"Fastest-rising keywords per category, {years[0]}–{years[-1]}", x=0.01, ha="left",
                 fontsize=15, fontweight="semibold", color=style.INK)
    fig.tight_layout(rect=(0, 0.03, 1, 0.97))
    style.source_note(fig, note)
    style.save(fig, path)


# ---------------------------------------------------------------- main

def main(argv=None):
    args = parse_args(argv)
    if not args.input.is_file():
        sys.exit(f"Dataset not found: {args.input}\nSee docs/dataset.md for how to download it.")
    style.apply()
    started = datetime.now(timezone.utc)

    print(f"Reading {args.input} ...", file=sys.stderr)
    data = scan(args)
    latest = data["latest"]
    last_full = latest.year if (latest.month, latest.day) == (12, 31) else latest.year - 1
    base_years = year_list(args.base_years)
    recent_years = year_list(args.recent_years) if args.recent_years else [last_full - 1, last_full]
    if recent_years[-1] > last_full or base_years[0] < args.keyword_from_year:
        sys.exit("Keyword periods must lie between --keyword-from-year and the last full year.")
    primary, any_listing, cs_primary, all_total = data["primary"], data["any"], data["cs_primary"], data["all_total"]
    note = (f"Source: arXiv metadata snapshot (Cornell University, Kaggle), sha256 {data['sha256'][:12]}…; "
            "year = first-version submission date; label = primary category.")

    # 1. Annual counts and shares.
    count_rows = []
    for year in range(args.from_year, latest.year + 1):
        for c in args.categories:
            count_rows.append([year, c, primary[c][year], any_listing[c][year], cs_primary[year],
                               round(primary[c][year] / cs_primary[year], 5) if cs_primary[year] else "",
                               all_total[year], year > last_full])
    write_csv(args.output_dir / "annual_counts.csv",
              ["year", "category", "papers_primary", "papers_any_listing", "cs_primary_total",
               "share_of_cs_primary", "arxiv_total", "incomplete_year"], count_rows)

    # 2. Keyword trends.
    kw_years = list(range(args.keyword_from_year, last_full + 1))
    keywords = {}
    for c in args.categories:
        print(f"Keyword trends for {c} ...", file=sys.stderr)
        keywords[c] = keyword_trends(data["texts"][c], kw_years, base_years, recent_years, args)
    for direction in ("rising", "falling"):
        write_csv(args.output_dir / f"{direction}_keywords.csv",
                  ["category", "rank", "term", "base_share", "recent_share", "change_pp", "log_ratio",
                   "display_label", "similar_terms_merged"],
                  [[c, rank, r["term"], round(r["base_share"], 5), round(r["recent_share"], 5),
                    round(r["change_pp"], 2), round(r["log_ratio"], 4), display_label(r), "; ".join(r["similar_terms"])]
                   for c in args.categories for rank, r in enumerate(keywords[c][direction], start=1)])
    write_csv(args.output_dir / "keyword_trends.csv",
              ["category", "term", "direction", "year", "papers_with_term", "papers", "share"],
              [[c, r["term"], direction, year, int(keywords[c]["series"][r["term"]]["doc_count"][i]),
                int(keywords[c]["n_by_year"][i]), round(float(keywords[c]["series"][r["term"]]["share"][i]), 5)]
               for c in args.categories for direction in ("rising", "falling") for r in keywords[c][direction]
               for i, year in enumerate(kw_years)])

    # 3. Summary.
    base = args.index_base_year
    span = last_full - base
    summary = {
        "created_at": started.isoformat(timespec="seconds"),
        "dataset": {"file": args.input.name, "sha256": data["sha256"], "records": data["stats"]["records"],
                    "malformed": data["stats"]["malformed"], "missing_date": data["stats"]["missing_date"],
                    "latest_submission": latest.date().isoformat(), "last_full_year": last_full},
        "parameters": {"categories": args.categories, "from_year": args.from_year, "index_base_year": base,
                       "keyword_years": [kw_years[0], kw_years[-1]], "keyword_base_years": base_years,
                       "keyword_recent_years": recent_years, "min_share": args.min_share, "top_k": args.top_k,
                       "vocab_sample": args.vocab_sample, "min_df": args.min_df,
                       "min_abstract_words": args.min_abstract_words, "seed": args.seed,
                       "keyword_measure": "share of the category's papers (title + abstract) containing the term",
                       "rising_score": "log((recent_share + 0.002) / (base_share + 0.002))",
                       "stop_words": "scikit-learn English list + ACADEMIC_STOP_WORDS (manual, see ml/trends.py); URLs removed",
                       "same_concept_rule": "word subset/superset ignoring plurals, or Jaccard >= "
                                            f"{SAME_CONCEPT_JACCARD} of the papers containing each term"},
        "categories": {
            c: {
                f"papers_{base}": primary[c][base],
                f"papers_{last_full}": primary[c][last_full],
                "growth_multiple": round(primary[c][last_full] / primary[c][base], 3) if primary[c][base] else None,
                "cagr": round((primary[c][last_full] / primary[c][base]) ** (1 / span) - 1, 4)
                if primary[c][base] and span > 0 else None,
                f"share_of_cs_{base}": round(primary[c][base] / cs_primary[base], 4),
                f"share_of_cs_{last_full}": round(primary[c][last_full] / cs_primary[last_full], 4),
                "keyword_papers": int(keywords[c]["n_by_year"].sum()),
                "keyword_vocabulary_size": keywords[c]["vocabulary_size"],
                "top_rising_keywords": [display_label(r) for r in keywords[c]["rising"][:5]],
                "top_falling_keywords": [display_label(r) for r in keywords[c]["falling"][:5]],
            }
            for c in args.categories
        },
        "limitations": [
            "arXiv submissions are a proxy for research activity, not all published research; arXiv's own growth "
            "and field-specific posting habits affect the counts.",
            "Counts use the primary category; papers_any_listing in annual_counts.csv also counts cross-listings.",
            f"{latest.year} is incomplete and excluded from growth, keyword periods and charts.",
            "Keyword shares are word-occurrence statistics; they describe what is written about, not research "
            "quality, impact or gaps.",
        ],
    }
    (args.output_dir / "trends_summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")

    # 4. Figures.
    years = list(range(args.from_year, last_full + 1))
    figure_counts(args.figures_dir / "01_papers_per_year.png", years, args.categories, primary, last_full, latest,
                  note)
    figure_index(args.figures_dir / "02_growth_index.png", list(range(base, last_full + 1)), args.categories,
                 primary, base, last_full, note)
    figure_share(args.figures_dir / "03_share_of_cs.png", years, args.categories, primary, cs_primary, last_full,
                 note)
    figure_keywords(args.figures_dir / "04_rising_keywords.png", kw_years, args.categories, keywords, base_years,
                    recent_years, note)

    print(f"\nLatest submission {latest.date()}, last full year {last_full}", file=sys.stderr)
    for c in args.categories:
        s = summary["categories"][c]
        print(f"  {c}: {s[f'papers_{base}']:,} -> {s[f'papers_{last_full}']:,} papers "
              f"(x{s['growth_multiple']}, CAGR {s['cagr']:.1%}); rising: {', '.join(s['top_rising_keywords'][:3])}",
              file=sys.stderr)
    print(f"Reports in {args.output_dir}, figures in {args.figures_dir}", file=sys.stderr)


if __name__ == "__main__":
    main()
