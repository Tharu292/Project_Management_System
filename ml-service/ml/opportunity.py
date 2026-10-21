"""Research opportunity analysis: retrieval + topics + coverage -> ranked potential directions.

Given a title and abstract:

1. Similar papers: TF-IDF cosine similarity over the corpus (real arXiv papers).
2. Topic profile: R = 0.5 * (the text's own NMF topic shares)
                    + 0.5 * (mean topic shares of its 50 most similar papers).
3. Candidate directions: topic pairs (a, b), a among the 3 and b among the 8 most
   relevant topics of R. A pair stands for papers that cover both topics (share
   >= the model's threshold for each).
4. Evidence per pair: papers in the old and recent windows (real counts), the
   change in their share of all papers, how many of the 50 similar papers combine
   both topics, and the share in the control set of OTHER cs.* categories.
5. Eligibility: at least MIN_RECENT_PAPERS recent papers; otherwise the pair is
   listed as "not enough evidence in this corpus", never as an opportunity.
6. Score (each factor as a percentile rank among the eligible pairs, 0..1):
       0.40 * relevance (geometric mean of R_a and R_b)
     + 0.25 * (1 - recent coverage share)      # relatively less studied here
     + 0.20 * growth (old -> recent window)     # gaining attention
     + 0.15 * support among the similar papers  # grounded in close work
   The weights are a documented design choice, not learned from data.
7. Coverage note: if the pair is clearly more common in the control set, the low
   count is most likely a dataset-coverage effect, not a research gap.

The output describes potential directions grounded in corpus evidence. It does not
claim that any topic is unexplored or novel, which would need external verification.
"""

import math
from pathlib import Path

import joblib
import numpy as np
from scipy import sparse
from scipy.stats import rankdata

from ml.categories import category_name
from ml.text_utils import build_text

N_NEIGHBOURS = 50
TOP_A, TOP_B = 3, 8
MIN_RECENT_PAPERS = 5
WEIGHTS = {"relevance": 0.40, "low_coverage": 0.25, "growth": 0.20, "neighbour_support": 0.15}
LOW_COHERENCE = 0.0
ARXIV_ABS = "https://arxiv.org/abs/"

LIMITATIONS = [
    "The corpus is arXiv only: papers whose primary category is cs.CV, cs.CL, cs.CR, cs.RO or cs.DB, first "
    "submitted from 2015. Computer Vision makes up about half of it, so counts are not balanced across areas.",
    "Low coverage means relatively few papers in THIS corpus combine the topics. It is not proof of a research "
    "gap: the work may exist in other venues, other arXiv categories, or under different wording.",
    "Directions are potential, evidence-based suggestions. None is claimed to be unexplored or novel; check the "
    "literature and discuss with your supervisor before relying on one.",
    "Topics come from an NMF topic model (30 topics); a few have lower coherence and may mix themes.",
    "The ranking weights are a documented design choice, not learned from data, and no expert has rated the "
    "recommendations yet.",
    "Similarity is lexical (TF-IDF): papers that use different words for the same idea can be missed.",
]


def percentile(values):
    values = np.asarray(values, dtype=float)
    if len(values) == 1:
        return np.ones(1)
    return (rankdata(values, method="average") - 1) / (len(values) - 1)


class OpportunityEngine:
    def __init__(self, models_dir):
        models_dir = Path(models_dir)
        vectorizers = joblib.load(models_dir / "retrieval_vectorizer.joblib")
        self.counter, self.weigher = vectorizers["counter"], vectorizers["weigher"]
        self.matrix = sparse.load_npz(models_dir / "retrieval_matrix.npz").tocsr()
        meta = joblib.load(models_dir / "corpus_meta.joblib")
        self.ids, self.titles, self.years = meta["ids"], meta["titles"], meta["years"]
        self.primary, self.categories = meta["primary"], meta["categories"]
        topics = joblib.load(models_dir / "topics.joblib")
        self.topic_vectorizer, self.nmf = topics["vectorizer"], topics["nmf"]
        self.shares, self.tau, self.topics = topics["shares"], topics["share_threshold"], topics["topics"]
        self.year_list = topics["years"]
        self.by_year, self.papers_per_year = topics["pair_counts_by_year"], topics["papers_per_year"]
        self.windows = topics["windows"]
        self.control_counts, self.control_papers = topics["control_pair_counts"], topics["control_papers"]
        self.window_counts = {name: self._window(span) for name, span in self.windows.items()}
        recent, total = self.window_counts["recent"]
        upper = recent[np.triu_indices_from(recent, k=1)] / max(total, 1)
        self.coverage_quartiles = np.quantile(upper[upper > 0], [0.25, 0.75]) if (upper > 0).any() else (0, 0)
        if self.matrix.shape[0] != len(self.ids) or self.shares.shape[0] != len(self.ids):
            raise ValueError("Retrieval index, metadata and topic shares do not describe the same corpus.")

    def _window(self, span):
        idx = [i for i, y in enumerate(self.year_list) if y in span]
        return self.by_year[idx].sum(axis=0), int(self.papers_per_year[idx].sum())

    # ------------------------------------------------------------------ pieces

    def paper(self, i, similarity=None, rank=None):
        item = {"arxivId": str(self.ids[i]), "title": str(self.titles[i]), "year": int(self.years[i]),
                "primaryCategory": str(self.primary[i]), "categoryName": category_name(str(self.primary[i])),
                "url": ARXIV_ABS + str(self.ids[i])}
        if rank is not None:
            item["rank"] = rank
        if similarity is not None:
            item["similarity"] = round(float(similarity), 4)
        return item

    def similarity_scores(self, text):
        q = self.weigher.transform(self.counter.transform([text]))
        return np.asarray((self.matrix @ q.T).todense()).ravel(), int(q.nnz)

    def topic_shares(self, text):
        w = self.nmf.transform(self.topic_vectorizer.transform([text]))[0]
        return w / w.sum() if w.sum() > 0 else w

    def topic_label(self, t):
        return self.topics[t]["label"]

    # ------------------------------------------------------------------ analysis

    def analyse(self, title, abstract, n_similar=10, n_directions=5, exclude_id=None):
        text = build_text(title, abstract)
        scores, recognised = self.similarity_scores(text)
        if exclude_id is not None:
            scores[self.ids == exclude_id] = -1.0
        order = np.argpartition(-scores, N_NEIGHBOURS)[:N_NEIGHBOURS]
        neighbours = order[np.argsort(-scores[order])]
        own = self.topic_shares(text)
        profile = 0.5 * own + 0.5 * self.shares[neighbours].mean(axis=0)
        ranked_topics = np.argsort(profile)[::-1]
        recent_counts, recent_total = self.window_counts["recent"]
        old_counts, old_total = self.window_counts["old"]
        covered = self.shares[neighbours] >= self.tau

        candidates, insufficient = [], []
        seen = set()
        for a in ranked_topics[:TOP_A]:
            for b in ranked_topics[:TOP_B]:
                pair = tuple(sorted((int(a), int(b))))
                if a == b or pair in seen:
                    continue
                seen.add(pair)
                x, y = pair
                recent, old = int(recent_counts[x, y]), int(old_counts[x, y])
                recent_share, old_share = recent / max(recent_total, 1), old / max(old_total, 1)
                control_recent = int(self.control_counts["recent"][x, y])
                item = {
                    "topics": [x, y],
                    "relevance": float(math.sqrt(profile[x] * profile[y])),
                    "recent": recent, "old": old, "recentShare": recent_share, "oldShare": old_share,
                    "growth": float(math.log((recent_share + 1e-4) / (old_share + 1e-4))),
                    "neighbourSupport": int(np.logical_and(covered[:, x], covered[:, y]).sum()),
                    "controlRecent": control_recent,
                    "controlShare": control_recent / max(self.control_papers["recent"], 1),
                }
                (candidates if recent >= MIN_RECENT_PAPERS else insufficient).append(item)

        if candidates:
            factors = {
                "relevance": percentile([c["relevance"] for c in candidates]),
                "low_coverage": 1 - percentile([c["recentShare"] for c in candidates]),
                "growth": percentile([c["growth"] for c in candidates]),
                "neighbour_support": percentile([c["neighbourSupport"] for c in candidates]),
            }
            for i, c in enumerate(candidates):
                c["factors"] = {name: round(float(values[i]), 3) for name, values in factors.items()}
                c["score"] = round(sum(WEIGHTS[name] * c["factors"][name] for name in WEIGHTS), 4)
        candidates.sort(key=lambda c: -c["score"])
        directions = [self._direction(rank, c, scores, exclude_id) for rank, c in enumerate(candidates[:n_directions], 1)]

        return {
            "similarPapers": [self.paper(i, scores[i], r) for r, i in enumerate(neighbours[:n_similar], 1)],
            "recognisedTerms": recognised,
            "topicProfile": [
                {"topicId": int(t), "label": self.topic_label(t), "topTerms": self.topics[t]["top_terms"][:6],
                 "weight": round(float(profile[t]), 4), "ownWeight": round(float(own[t]), 4),
                 "lowerCoherence": self.topics[t]["npmi"] < LOW_COHERENCE}
                for t in ranked_topics[:5]],
            "directions": directions,
            "insufficientEvidence": [
                {"topics": [self._topic_ref(t) for t in c["topics"]], "recentPapers": c["recent"], "olderPapers": c["old"]}
                for c in sorted(insufficient, key=lambda c: -c["relevance"])[:5]],
            "windows": {"older": self.windows["old"], "recent": self.windows["recent"],
                        "olderPapers": old_total, "recentPapers": recent_total},
            "candidatesConsidered": len(candidates) + len(insufficient),
            "method": {
                "retrieval": "TF-IDF cosine similarity over the corpus",
                "topics": f"NMF topic model, {len(self.topics)} topics; a paper covers a topic when its share >= {self.tau}",
                "profile": "0.5 x the text's topic shares + 0.5 x mean shares of its 50 most similar papers",
                "candidates": f"pairs of the {TOP_A} and {TOP_B} most relevant topics",
                "eligibility": f"at least {MIN_RECENT_PAPERS} papers in the recent window",
                "score": " + ".join(f"{w:.2f} x {name.replace('_', ' ')}" for name, w in WEIGHTS.items())
                         + " (each factor a percentile rank among eligible pairs)",
            },
            "limitations": LIMITATIONS,
        }

    def _topic_ref(self, t):
        return {"topicId": int(t), "label": self.topic_label(t), "topTerms": self.topics[t]["top_terms"][:6],
                "lowerCoherence": self.topics[t]["npmi"] < LOW_COHERENCE}

    def _coverage_note(self, c):
        low, high = self.coverage_quartiles
        if c["controlRecent"] >= 10 and c["controlShare"] >= 2 * c["recentShare"]:
            return ("dataset_coverage",
                    "More common in other computer-science categories (such as cs.LG or cs.AI) than in this corpus: "
                    "the low count here is most likely a dataset-coverage effect, not a research gap.")
        if c["recent"] < 20:
            return ("limited_evidence", "Few papers in this corpus combine these topics, so the evidence is limited.")
        if c["recentShare"] <= low:
            return ("relatively_low", "Among the less covered topic combinations in this corpus.")
        if c["recentShare"] >= high:
            return ("well_covered", "Among the more covered topic combinations in this corpus.")
        return ("moderate", "Moderately covered in this corpus.")

    def _direction(self, rank, c, scores, exclude_id):
        x, y = c["topics"]
        both = np.where((self.shares[:, x] >= self.tau) & (self.shares[:, y] >= self.tau))[0]
        if exclude_id is not None:
            both = both[self.ids[both] != exclude_id]
        support = both[np.argsort(-scores[both])][:5]
        kind, note = self._coverage_note(c)
        older, recent = self.windows["old"], self.windows["recent"]
        change = "grew" if c["growth"] > 0.05 else "fell" if c["growth"] < -0.05 else "stayed about the same"
        label_x, label_y = self.topic_label(x), self.topic_label(y)
        return {
            "rank": rank,
            "title": f"{label_x}  ×  {label_y}",
            "topics": [self._topic_ref(x), self._topic_ref(y)],
            "summary": (
                f"{c['recent']} papers in {recent[0]}–{recent[-1]} cover both topics "
                f"({c['recentShare'] * 100:.2f} in every 100 papers), against {c['old']} in {older[0]}–{older[-1]} "
                f"({c['oldShare'] * 100:.2f} in every 100): their share {change}. "
                f"{c['neighbourSupport']} of the {N_NEIGHBOURS} papers most similar to your text combine them."
            ),
            "coverage": {"assessment": kind, "note": note},
            "evidence": {
                "recentPapers": c["recent"], "olderPapers": c["old"],
                "recentShare": round(c["recentShare"], 5), "olderShare": round(c["oldShare"], 5),
                "growthLogRatio": round(c["growth"], 4), "similarPapersCombining": c["neighbourSupport"],
                "otherCsCategoriesShare": round(c["controlShare"], 5), "otherCsCategoriesPapers": c["controlRecent"],
                "corpusPapersCombining": int(len(both)),
            },
            "score": c["score"],
            "factors": c["factors"],
            "weights": WEIGHTS,
            "supportingPapers": [self.paper(i, scores[i]) for i in support],
        }
