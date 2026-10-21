"""Aspect-level research gap analysis (abstract-level evidence only).

For a title and abstract:

1. Relevant papers: the N_RELEVANT most similar corpus papers (the existing TF-IDF
   retrieval of the opportunity engine, used read-only).
2. Wider area: the other papers covering the text's two strongest NMF topics.
3. Aspect coverage: for every aspect (evaluation settings, metrics, application
   domains, datasets), how many relevant ABSTRACTS mention it, with a Wilson 95%
   interval, against its rate in the wider area.
   * Well covered: mentioned by at least WELL_COVERED relevant abstracts.
   * Under-represented, anchored to the text: the text mentions the aspect but at
     most ANCHORED_MAX relevant abstracts do.
   * Under-represented, relative to the wider area: rarer among the relevant
     abstracts than in the wider area by an exploratory one-sided binomial test,
     Benjamini-Hochberg q < 0.05, for aspects found in at least 5% of the area.
   Method terms: the text's most distinctive TF-IDF terms and how many relevant
   abstracts contain them.
4. Author statements: candidate future-work, under-explored and limitation
   sentences quoted exactly from the relevant papers' abstracts.
5. Two separate result lists:
   * directly supported: aspects that relevant papers' own abstracts describe as
     under-explored, future work or limited (quotes);
   * inferred: under-represented aspects from step 3, each with the rule that
     fired, the counts, the interval and the comparison rate.

All findings are abstract-level: an abstract that does not mention an aspect does
not show that the paper (or the field) did not study it. Intervals and tests are
descriptive and exploratory, not proof of a research gap.
"""

import math
import re
from pathlib import Path

import joblib
import numpy as np
from scipy.stats import binomtest

from ml.gap_aspects import FAMILY_LABELS, STATEMENT_TYPES, DatasetLookup, dataset_key, dataset_names, lexicon_aspects
from ml.text_utils import build_text, clean_text

N_RELEVANT = 100
WELL_COVERED = 10
ANCHORED_MAX = 3
AREA_MIN_RATE = 0.05
AREA_MIN_PAPERS = 30
Q_THRESHOLD = 0.05
MAX_STATEMENTS_PER_TYPE = 6
# Statement types that can support a potential gap. Limitations of prior work, limitations the paper says it
# addresses, and limitations whose owner is unclear are motivation or unclear, so they stay raw statements only.
GAP_TYPES = ("under_explored", "future_work", "limitation_own", "limitation_evaluated")

# Potential research gaps: evidence-supported and connected to the text.
QUERY_TERMS = 15          # the text's most distinctive TF-IDF terms
MIN_SHARED_WORDS = 2      # a statement must share an aspect of the text or >= 2 distinct words of those terms
CLOSE_RANK = 30           # a relevance signal (shown and used for ordering), never sufficient on its own
RECENT_YEARS = 3          # older supporting statements are kept, with a warning
MAX_POTENTIAL_GAPS = 8
MAX_GAP_STATEMENTS = 4
UNCERTAINTY = {"corroborated": "Corroborated signal", "indicative": "Indicative signal",
               "exploratory": "Exploratory signal"}
UNCERTAINTY_RULES = {
    "corroborated": "An author statement and low coverage in the closest abstracts point to the same aspect. "
                    "This agreement does not establish that the problem is unresolved.",
    "indicative": f"Author statements in two or more of the closest papers, or one from the last {RECENT_YEARS} years.",
    "exploratory": f"One signal only: few close abstracts mention an aspect of your text, or a single author "
                   f"statement older than {RECENT_YEARS} years.",
}
TYPE_PHRASE = {"future_work": "left for future work", "under_explored": "under-explored",
               "limitation_own": "a limitation of the authors' own approach",
               "limitation_evaluated": "a limitation found in the systems the paper evaluated"}
TYPE_HEADING = {"future_work": "Future work", "under_explored": "Described as under-explored",
                "limitation_own": "Stated limitation", "limitation_evaluated": "Limitation of evaluated systems"}
# Aspects too generic to stand alone as a card heading ("Accuracy", "Multimodal"): every evaluation metric and these
# broad settings or domains. Their heading gains the kind of evidence and the shared terms (presentation only).
GENERIC_HEADING_ASPECTS = frozenset({"setting:multimodal", "setting:efficiency", "setting:scalability",
                                     "setting:real_time", "setting:robustness", "setting:safety",
                                     "application:networks"})
COVERAGE_HEADING = "Rarely mentioned in the closest abstracts"
MAX_HEADING_TERMS = 2

LIMITATIONS = [
    "Abstract-level evidence only: the arXiv snapshot contains no full paper text. An abstract that does not mention "
    "an aspect does not show that the paper, or the field, did not study it.",
    "Aspects come from curated word lists (evaluation settings, metrics, application domains) and from dataset names "
    "found in abstracts. The lists are a documented design choice and miss synonyms.",
    "Author statements are found by cue phrases and typed automatically (future work, under-explored, whose "
    "limitation). The typing can be wrong; its precision has not been measured yet.",
    "Counts, intervals and significance tests are descriptive and exploratory. They are not proof of a research gap.",
    "The corpus is arXiv only (cs.CV, cs.CL, cs.CR, cs.RO, cs.DB primary categories, from 2015) and about half "
    "Computer Vision.",
    "Nothing here is claimed to be unexplored or novel. Check the full papers and the wider literature, and discuss "
    "with your supervisor.",
]


def wilson(k, n, z=1.96):
    if n == 0:
        return (0.0, 0.0)
    p = k / n
    centre = (p + z * z / (2 * n)) / (1 + z * z / n)
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return (max(0.0, centre - half), min(1.0, centre + half))


def benjamini_hochberg(p_values):
    p = np.asarray(p_values, dtype=float)
    if len(p) == 0:
        return p
    order = np.argsort(p)
    ranked = p[order] * len(p) / (np.arange(len(p)) + 1)
    q = np.minimum.accumulate(ranked[::-1])[::-1]
    out = np.empty_like(q)
    out[order] = np.minimum(q, 1.0)
    return out


def _gap_heading(aspect, kind, terms):
    """A potential gap's card heading; only the wording, never the evidence behind it.

    A specific aspect ("Robot manipulation / grasping") is its own heading. A generic one ("Accuracy") is prefixed with
    the kind of evidence of the closest supporting statement (or the coverage signal) and followed by up to
    MAX_HEADING_TERMS shared terms: "Limitation of evaluated systems: Accuracy (federated learning)".
    """
    if aspect["family"] != "metric" and aspect["aspectId"] not in GENERIC_HEADING_ASPECTS:
        return aspect["label"]
    label_words = set(re.findall(r"[a-z0-9]+", aspect["label"].lower()))
    context = [t for t in sorted(terms) if not set(t.split()) <= label_words][:MAX_HEADING_TERMS]
    lead = TYPE_HEADING[kind] if kind else COVERAGE_HEADING
    return f"{lead}: {aspect['label']}" + (f" ({', '.join(context)})" if context else "")


def _display_terms(terms):
    """Distinct terms, dropping a single word that is part of a longer shared term ("phishing websites" covers "websites")."""
    phrases = [t for t in terms if " " in t]
    return sorted(t for t in set(terms) if " " in t or not any(t in p.split() for p in phrases))


class GapAnalyzer:
    def __init__(self, engine, gap_dir):
        self.engine = engine
        store = joblib.load(Path(gap_dir) / "evidence.joblib")
        self.columns = store["columns"]
        self.matrix = store["aspect_matrix"].tocsc()
        self.matrix_rows = store["aspect_matrix"].tocsr()
        self.statement_types = store["statement_types"]
        self.statements = store["statements"]
        self.lexicon_version = store["lexicon_version"]
        if self.matrix.shape[0] != len(engine.ids):
            raise ValueError("The gap evidence store and the retrieval index describe different corpora.")
        self.col_index = {(c["family"], c["id"]): i for i, c in enumerate(self.columns)}
        self.dataset_columns = {c["label"]: i for i, c in enumerate(self.columns) if c["family"] == "dataset"}
        self.dataset_lookup = DatasetLookup(self.dataset_columns)
        rows = self.statements["row"]
        self._first = np.searchsorted(rows, np.arange(len(engine.ids)), side="left")
        self._last = np.searchsorted(rows, np.arange(len(engine.ids)), side="right")

    # ------------------------------------------------------------------ helpers

    def _column_ref(self, i):
        c = self.columns[i]
        return {"aspectId": f"{c['family']}:{c['id']}", "family": c["family"], "familyLabel": FAMILY_LABELS[c["family"]],
                "label": c["label"]}

    def _text_aspects(self, text):
        found = {self.col_index[a] for a in lexicon_aspects(text) if a in self.col_index}
        for name in dataset_names(text):
            key = ("dataset", dataset_key(name))
            if key in self.col_index:
                found.add(self.col_index[key])
        # Known dataset names written without "dataset"/"benchmark" after them (exact, case-sensitive).
        found |= {self.dataset_columns[name] for name in self.dataset_lookup.find(text)}
        return found

    def _statements_of(self, row):
        a, b = self._first[row], self._last[row]
        return range(a, b)

    def _paper(self, row, rank, scores):
        item = self.engine.paper(row, scores[row])
        item["relevanceRank"] = rank
        return item

    def _potential_gaps(self, relevant, rank_of, scores, text_aspects, inferred, query_terms, rel_counts, n):
        """Evidence-supported potential gaps connected to the text, each with an uncertainty label.

        Kept apart from the raw statements and from the area comparison: a candidate needs an author statement of a
        GAP_TYPES type that mentions an aspect of the text or shares MIN_SHARED_WORDS words of its distinctive terms,
        and/or the anchored coverage rule (the text's own aspect, rare among the closest abstracts).
        """
        reference_year = int(np.max(self.engine.years))
        screening = {"statementsConsidered": 0, "excluded": {
            "limitationOfPriorWorkOrAddressedByThePaper": 0, "limitationWithUnclearOwner": 0,
            "notConnectedToYourText": 0, "rarerThanTheWiderAreaOnly": 0}}
        candidates = []
        for r in relevant:
            for s in self._statements_of(int(r)):
                kind = self.statement_types[int(self.statements["type"][s])]
                screening["statementsConsidered"] += 1
                if kind in ("limitation_prior", "limitation_addressed"):
                    screening["excluded"]["limitationOfPriorWorkOrAddressedByThePaper"] += 1
                elif kind == "limitation_unclear":
                    screening["excluded"]["limitationWithUnclearOwner"] += 1
                elif kind in GAP_TYPES:
                    candidates.append((int(r), s, kind))
        shared = {}
        if candidates:
            vectors = self.engine.counter.transform([clean_text(str(self.statements["text"][s])) for _, s, _ in candidates])
            for c, (_, s, _) in enumerate(candidates):
                shared[s] = sorted(query_terms[j] for j in vectors[c].indices if j in query_terms)

        groups = {}
        for r, s, kind in candidates:
            aspects = sorted((int(a) for a in self.statements["aspects"][s] if int(a) in text_aspects),
                             key=lambda a: rel_counts[a])  # the most specific (rarest) aspect first
            terms = _display_terms(shared[s])
            words = {w for t in terms for w in t.split()}
            if not aspects and len(words) < MIN_SHARED_WORDS:
                screening["excluded"]["notConnectedToYourText"] += 1
                continue
            # Term-connected statements of one type sharing the same terms form one gap, across papers.
            key = ("aspect", aspects[0]) if aspects else ("terms", kind, tuple(terms))
            group = groups.setdefault(key, {"statements": [], "papers": set(), "kinds": set(), "terms": set(),
                                            "coverage": None})
            group["papers"].add(r)
            group["kinds"].add(kind)
            group["terms"].update(terms)
            group["statements"].append((r, s, kind))
        for i, item in inferred.items():
            if item["rule"].startswith("anchored"):
                groups.setdefault(("aspect", i), {"statements": [], "papers": set(), "kinds": set(), "terms": set(),
                                                  "coverage": None})["coverage"] = item
            else:
                screening["excluded"]["rarerThanTheWiderAreaOnly"] += 1

        gaps = []
        for key, g in groups.items():
            aspect = self._column_ref(key[1]) if key[0] == "aspect" else None
            statements = sorted(g["statements"], key=lambda x: rank_of[x[0]])
            years = [int(self.engine.years[r]) for r, _, _ in statements]
            latest = max(years) if years else None
            recent = latest is not None and latest >= reference_year - RECENT_YEARS
            if g["coverage"] is not None and statements:
                level = "corroborated"
            elif statements and (len(g["papers"]) >= 2 or recent):
                level = "indicative"
            else:
                level = "exploratory"
            closest = min((rank_of[r] for r in g["papers"]), default=None)

            why, notes = [], []
            if statements:
                phrases = " / ".join(TYPE_PHRASE[k] for k in GAP_TYPES if k in g["kinds"])
                why.append(f"{len(statements)} author statement{'s' if len(statements) != 1 else ''} in "
                           f"{len(g['papers'])} of the {n} most similar papers describe{'s' if len(statements) == 1 else ''} "
                           f"this as {phrases}.")
                link = []
                if aspect:
                    link.append(f"the aspect “{aspect['label']}”")
                if g["terms"]:
                    link.append("the terms " + ", ".join(f"“{t}”" for t in sorted(g["terms"])[:4]))
                why.append("Connected to your text through " + " and ".join(link) + ".")
                why.append(f"Closest supporting paper: rank {closest} of {n}"
                           + (f" (among the {CLOSE_RANK} closest)." if closest <= CLOSE_RANK else "."))
            if g["coverage"] is not None:
                c = g["coverage"]
                why.append(f"Your text mentions {c['label'].lower()}, but only {c['relevantPapers']} of the {n} most "
                           f"similar abstracts do (95% interval {c['interval95'][0] * 100:.1f}–"
                           f"{c['interval95'][1] * 100:.1f} in every 100).")
                notes.append("Few mentions in abstracts do not show that the aspect was not studied: full papers and "
                             "other venues may cover it.")
            if statements and not recent:
                notes.append(f"Older evidence: the most recent supporting statement is from {latest}. This may already "
                             "have been addressed by later work.")
            elif statements and min(years) < reference_year - RECENT_YEARS:
                notes.append(f"Some supporting statements are older than {RECENT_YEARS} years and may already have "
                             "been addressed.")
            if "under_explored" in g["kinds"]:
                notes.append("The paper that describes this as under-explored works on it itself, so part of it may "
                             "already be addressed.")
            if "limitation_evaluated" in g["kinds"]:
                notes.append("Limitations of evaluated systems describe those systems at the time of the paper.")

            if aspect:
                heading = _gap_heading(aspect, statements[0][2] if statements else None, g["terms"])
            else:
                heading = f"{TYPE_HEADING[next(iter(g['kinds']))]}: {', '.join(sorted(g['terms'])[:3])}"
            gaps.append({
                "heading": heading,
                "aspect": aspect,
                "signals": (["author_statements"] if statements else []) + (["low_coverage"] if g["coverage"] else []),
                "uncertainty": level,
                "uncertaintyLabel": UNCERTAINTY[level],
                "explanation": " ".join(why),
                "notes": notes,
                "paperCount": len(g["papers"]),
                "statementCount": len(statements),
                "latestYear": latest,
                "closestRank": closest,
                "sharedTerms": sorted(g["terms"]),
                "statements": [{"quote": str(self.statements["text"][s]), "type": k, "typeLabel": STATEMENT_TYPES[k],
                                "paper": self._paper(r, rank_of[r], scores)}
                               for r, s, k in statements[:MAX_GAP_STATEMENTS]],
                "coverage": g["coverage"] and {k: g["coverage"][k] for k in (
                    "relevantPapers", "relevantTotal", "share", "interval95", "examplePapers")},
            })
        order = {"corroborated": 0, "indicative": 1, "exploratory": 2}
        gaps.sort(key=lambda g: (order[g["uncertainty"]], -g["paperCount"], g["closestRank"] or n + 1))
        screening["shown"] = min(len(gaps), MAX_POTENTIAL_GAPS)
        screening["candidates"] = len(gaps)
        return gaps[:MAX_POTENTIAL_GAPS], screening

    # ------------------------------------------------------------------ analysis

    def analyse(self, title, abstract, exclude_id=None):
        text = build_text(title, abstract)
        scores, recognised = self.engine.similarity_scores(text)
        if exclude_id is not None:
            scores[self.engine.ids == exclude_id] = -1.0
        top = np.argpartition(-scores, N_RELEVANT)[:N_RELEVANT]
        relevant = top[np.argsort(-scores[top])]
        rank_of = {int(r): i + 1 for i, r in enumerate(relevant)}
        n = len(relevant)

        # Wider area: papers covering the text's two strongest topics (profile as in the opportunity engine).
        own = self.engine.topic_shares(text)
        profile = 0.5 * own + 0.5 * self.engine.shares[relevant[:50]].mean(axis=0)
        area_topics = [int(t) for t in np.argsort(profile)[::-1][:2]]
        in_area = (self.engine.shares[:, area_topics] >= self.engine.tau).any(axis=1)
        in_area[relevant] = False
        if exclude_id is not None:
            in_area[self.engine.ids == exclude_id] = False
        area_rows = np.where(in_area)[0]
        area_n = len(area_rows)

        rel_counts = np.asarray(self.matrix_rows[relevant].sum(axis=0)).ravel()
        area_counts = np.asarray(self.matrix_rows[area_rows].sum(axis=0)).ravel() if area_n else np.zeros(len(self.columns))
        text_aspects = self._text_aspects(text)

        def mentioning(i, limit=3):
            rows = [int(r) for r in relevant if self.matrix_rows[r, i]]
            return [self._paper(r, rank_of[r], scores) for r in rows[:limit]], len(rows)

        def coverage(i):
            k = int(rel_counts[i])
            low, high = wilson(k, n)
            area_rate = area_counts[i] / area_n if area_n else 0.0
            return {**self._column_ref(i), "relevantPapers": k, "relevantTotal": n,
                    "share": round(k / n, 4), "interval95": [round(low, 4), round(high, 4)],
                    "areaPapers": int(area_counts[i]), "areaTotal": area_n, "areaShare": round(float(area_rate), 4),
                    "inYourText": i in text_aspects}

        well = []
        for i in np.argsort(-rel_counts):
            if rel_counts[i] < WELL_COVERED:
                break
            item = coverage(int(i))
            item["examplePapers"], _ = mentioning(int(i))
            well.append(item)

        # Inferred under-representation.
        inferred = {}
        for i in sorted(text_aspects):
            if rel_counts[i] <= ANCHORED_MAX:
                item = coverage(i)
                item["examplePapers"], _ = mentioning(i)
                item["rule"] = "anchored"
                item["why"] = (f"Your text mentions {item['label'].lower()}, but only {item['relevantPapers']} of the "
                               f"{n} most similar abstracts do (95% interval {item['interval95'][0] * 100:.1f}–"
                               f"{item['interval95'][1] * 100:.1f} in every 100).")
                inferred[i] = item
        tested = [i for i in range(len(self.columns))
                  if area_n and area_counts[i] >= AREA_MIN_PAPERS and area_counts[i] / area_n >= AREA_MIN_RATE]
        p_values = [binomtest(int(rel_counts[i]), n, area_counts[i] / area_n, alternative="less").pvalue for i in tested]
        for i, p, q in zip(tested, p_values, benjamini_hochberg(p_values)):
            if q < Q_THRESHOLD:
                item = inferred.get(i) or coverage(i)
                item.setdefault("examplePapers", mentioning(i)[0])
                item["rule"] = "anchored+area" if i in inferred else "area"
                item["pValue"], item["qValue"] = float(p), float(q)
                area_why = (f"{item['relevantPapers']} of the {n} most similar abstracts mention it, against "
                            f"{item['areaShare'] * 100:.1f} in every 100 papers of the wider topic area "
                            f"(exploratory binomial test, q = {q:.3f}).")
                item["why"] = (item.get("why", "") + " " + area_why).strip()
                inferred[i] = item

        # Method terms: the text's most distinctive TF-IDF terms.
        q_vec = self.engine.weigher.transform(self.engine.counter.transform([text]))
        names = self.engine.counter.get_feature_names_out()
        rel_matrix = self.engine.matrix[relevant]
        method_terms = []
        for j in q_vec.indices[np.argsort(-q_vec.data)][:10]:
            k = int(rel_matrix[:, j].nnz)
            low, high = wilson(k, n)
            method_terms.append({"term": str(names[j]), "relevantPapers": k, "relevantTotal": n,
                                 "interval95": [round(low, 4), round(high, 4)], "fewMentions": k <= ANCHORED_MAX})

        # Author statements from the relevant abstracts.
        by_type = {t: [] for t in STATEMENT_TYPES}
        supported = {}
        for r in relevant:
            for s in self._statements_of(int(r)):
                kind = self.statement_types[int(self.statements["type"][s])]
                aspects = [int(a) for a in self.statements["aspects"][s]]
                quote = {"quote": str(self.statements["text"][s]), "type": kind, "typeLabel": STATEMENT_TYPES[kind],
                         "paper": self._paper(int(r), rank_of[int(r)], scores),
                         "aspects": [self._column_ref(a) for a in aspects]}
                if len(by_type[kind]) < MAX_STATEMENTS_PER_TYPE:
                    by_type[kind].append(quote)
                if kind in GAP_TYPES:
                    for a in aspects:
                        group = supported.setdefault(a, {**self._column_ref(a), "papers": set(), "statements": []})
                        group["papers"].add(int(r))
                        if len(group["statements"]) < 4:
                            group["statements"].append(quote)
        directly = sorted(({**{k: v for k, v in g.items() if k != "papers"}, "paperCount": len(g["papers"]),
                            "inYourText": a in text_aspects}
                           for a, g in supported.items()), key=lambda g: (-g["inYourText"], -g["paperCount"]))
        for i, item in inferred.items():
            item["corroboratedByAuthorStatements"] = i in supported

        query_terms = {int(j): str(names[j]) for j in q_vec.indices[np.argsort(-q_vec.data)][:QUERY_TERMS]}
        potential, screening = self._potential_gaps(relevant, rank_of, scores, text_aspects, inferred, query_terms,
                                                        rel_counts, n)

        return {
            "evidenceLevel": "abstract",
            "basis": ("Abstract-level evidence from the most similar real arXiv papers. Missing mentions in abstracts do "
                      "not show that an aspect has not been studied; statistics are exploratory, not proof of a gap."),
            "relevantPapers": [self._paper(int(r), i + 1, scores) for i, r in enumerate(relevant[:10])],
            "relevantTotal": n,
            "recognisedTerms": recognised,
            "wideArea": {"topics": [{"topicId": t, "label": self.engine.topic_label(t)} for t in area_topics],
                         "papers": area_n},
            "yourAspects": [self._column_ref(i) for i in sorted(text_aspects)],
            "wellCovered": well[:12],
            "methodTerms": method_terms,
            "authorStatements": {t: v for t, v in by_type.items() if v},
            "potentialGaps": potential,
            "potentialGapsScreening": screening,
            "uncertaintyLabels": [{"level": k, "label": UNCERTAINTY[k], "rule": v} for k, v in UNCERTAINTY_RULES.items()],
            "directlySupportedGaps": directly[:8],
            "inferredGaps": sorted(inferred.values(), key=lambda x: (x["rule"] == "area", x["relevantPapers"]))[:8],
            "method": {
                "relevantPapers": f"{n} most similar abstracts (TF-IDF cosine similarity)",
                "wideArea": "other papers covering the text's two strongest NMF topics",
                "wellCovered": f"aspects mentioned by at least {WELL_COVERED} of the {n} relevant abstracts",
                "anchoredRule": f"aspects in your text mentioned by at most {ANCHORED_MAX} relevant abstracts",
                "areaRule": f"one-sided binomial test against the wider area, Benjamini-Hochberg q < {Q_THRESHOLD}, "
                            f"for aspects in at least {int(AREA_MIN_RATE * 100)} of every 100 area papers",
                "statements": "cue-phrase sentences quoted exactly from the original abstracts (whitespace normalised)",
                "potentialGaps": (
                    "shown only with evidence and a connection to your text: an author statement (future work, "
                    "under-explored, own limitation or limitation of evaluated systems) that mentions an aspect of "
                    f"your text or at least {MIN_SHARED_WORDS} words of its {QUERY_TERMS} most distinctive terms, "
                    f"and/or an aspect of your text mentioned by at most {ANCHORED_MAX} of the {n} closest abstracts. "
                    "Rarity relative to the wider area alone is context, not a gap. Being among the "
                    f"{CLOSE_RANK} closest papers is a relevance signal only."),
                "lexiconVersion": self.lexicon_version,
            },
            "limitations": LIMITATIONS,
        }
