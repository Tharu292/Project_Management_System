# Research opportunity analysis: method, evaluation and limitations

Component 3, module 5. Given a research title and abstract, this feature produces
four things:
- the predicted research area;
- the most similar real arXiv papers;
- the topics the text combines;
- 3–5 ranked **potential** research directions, each with its evidence.

Every number comes from the real Cornell arXiv metadata snapshot. Nothing is
invented, and no topic is claimed to be unexplored or novel.

## Build (about 12 minutes on the development machine)

```powershell
cd ml-service
.\.venv\Scripts\Activate.ps1
python -m ml.opportunity_corpus --input data/raw/arxiv-metadata-oai-snapshot.json   # ~2 min
python -m ml.opportunity_retrieval    # TF-IDF index + retrieval evaluation, ~5 min
python -m ml.opportunity_topics       # NMF topic model + coverage tables, ~4 min
python -m ml.opportunity_evaluate     # recommendation checks, backtest, case studies, ~1 min
```

Where the outputs go:
- `data/opportunity/` and `models/opportunity/` (about 650 MB) are git-ignored.
- `reports/opportunity/` holds the evaluation files. They are small and committed.

The API loads the index the first time it's needed. That takes about 3 s and
about 500 MB of memory. Each analysis then takes about 0.15 s.

## Data

- **Corpus.** Papers whose **primary** category is cs.CV, cs.CL, cs.CR, cs.RO
  or cs.DB, first submitted from 2015 up to the end of the snapshot: **334,582
  papers**.
  - They pass the same filters as the classifier data: abstracts of at least
    30 words, and every copy of a duplicated title dropped.
  - Computer Vision is about 48% of the corpus.
- **Control set.** 120,000 hash-ranked papers whose primary category is
  **another** computer-science category, 2018 onwards. Mostly cs.LG (36%) and
  cs.AI (11%). It is used only to tell limited dataset coverage apart from a
  possible gap.

## Method

1. **Similar-paper retrieval.** TF-IDF over words and word pairs.
   - The vocabulary is learned from an 80,000-paper hash-ranked sample, to fit
     in memory. The IDF weights are computed over the whole corpus, and rows are
     L2-normalised, so the dot product is the cosine similarity.
   - Results are real papers with their arXiv ID and an
     `https://arxiv.org/abs/<id>` link.
2. **Topic discovery.** A trained **NMF topic model** (scikit-learn) on TF-IDF of
   words and word pairs. URLs and academic boilerplate are removed.
   - Training data: a balanced sample of up to 15,000 papers per category.
   - The number of topics, *k*, is chosen from {20, 30, 40} by the mean **NPMI
     coherence** of each topic's 10 top terms on a **held-out** set of 20,000
     papers. NPMI measures how often a topic's top words really occur together.
   - Result: **k = 30**.
   - A paper *covers* a topic when that topic makes up at least 15% of its
     topic mix (its share).
3. **Coverage analysis.** For every pair of topics: papers covering both, per
   year. The older window (2018–19) is compared with the recent one (2024–25),
   in the corpus and in the control set.
4. **Opportunity ranking.**
   - **Topic profile:** half the text's own topic shares, plus half the average
     shares of its 50 most similar papers.
   - **Candidates:** pairs drawn from the 3 and the 8 most relevant topics.
   - **Eligibility:** at least 5 papers in the recent window. Smaller
     combinations are listed as "too little evidence", never as opportunities.
   - **Score:** each factor is turned into a percentile rank among the eligible
     pairs (0 to 1), then:

         0.40 × relevance + 0.25 × (1 − coverage) + 0.20 × growth + 0.15 × support among the 50 similar papers

     The weights are a **documented design choice, not learned from data**.
   - **Coverage note.** If a pair is at least twice as common in the control set
     as in the corpus (with 10 or more control papers), the low count is labelled
     a likely **dataset-coverage effect**, not a research gap.

## Evaluation (generated: `reports/opportunity/`)

| What | Method | Result |
|---|---|---|
| Retrieval, known-item | 1,000 held-out queries; query = a paper's **title only**; relevant = that paper | Recall@1 0.922, Recall@10 0.989, MRR 0.948 |
| Retrieval, topical proxy | Share of the 10 nearest other papers with the query's primary category | 0.862 (random neighbours: 0.329) |
| Topic model | Held-out NPMI and diversity for k = 20 / 30 / 40 | 0.193 / **0.199** / 0.195; diversity 0.80 at k = 30; 3 of 30 topics with negative NPMI |
| Recommendations, grounding | 100 held-out 2026 papers (excluded from their own evidence) | 100% of 500 directions have 3 or more supporting papers |
| Recommendations, agreement | Both topics among the text's own top-5 topics | 79% |
| Recommendations, stability | Jaccard of the top-5 directions after removing 20% of words | 0.76 |
| Growth factor, backtest | Spearman between pair growth 2016-17 → 2020-21 and 2020-21 → 2024-25 | ρ = 0.23 (p = 0.0002, 255 pairs) |
| **Expert review** | Rating sheet with a rubric: `expert_review_sheet.csv` | **Not done: recommendation accuracy is not measured** |

How to read these results:
- **Known-item search is easy**, because a paper's title is part of its own
  indexed text. It shows that the index and ranking work; it does not show that
  the retrieved papers are research-relevant. **arXiv has no human relevance
  judgements.**
- **Category agreement is a proxy.** A useful neighbour can belong to another
  category.
- **The classifier's macro-F1 is not evidence for this feature.**
- **The backtest** only shows that past growth carries some information about
  later growth. It is not a test of research gaps.

## Not implemented

- **Semantic sentence embeddings.** They would need torch and
  sentence-transformers (about 2 GB, not approved), plus several hours of CPU
  time to embed 334,000 abstracts. This is planned as an enhancement, to be
  compared against TF-IDF with the same evaluation.
- **Expert evaluation.** The rating sheet is ready, but no ratings have been
  collected.
- **Checks outside arXiv**, such as other publishers or Google Scholar. None are
  made, so a low count can reflect where research is published, not whether it
  exists.

## Limitations and failure cases

- **One source, five areas.** The data is arXiv only, labelled by primary
  category, from 2015 onwards, and dominated by Computer Vision. Fields that
  post rarely on arXiv are under-represented.
- **Lexical similarity.** TF-IDF misses papers that describe the same idea in
  different words, and can over-rank papers that share generic wording.
- **NMF topics are imperfect.** Some mix themes. Three have negative coherence
  (security/blockchain, malware/intrusion, control/dynamics) and are flagged as
  "lower coherence" in the API and the app. One topic
  ("extensive · attention · experiments") is mostly generic wording.
- **Thresholds.** The 15% share threshold and the minimum of 5 recent papers
  shape the counts.
- **Recent windows.** These are dominated by large-language-model papers, so
  combinations with "llms" often rank high on growth.
- **What a direction is.** A suggestion to investigate further with a
  supervisor, not a finding.
- **Observed failure case.** In a live test, an abstract on federated learning
  with differential privacy for medical image segmentation was given the
  "reinforcement learning" topic. The only reason was the generic word
  "learning" in "federated learning". Two of the resulting directions combined
  privacy or segmentation with reinforcement learning.
  - One of them was correctly marked as a likely **dataset-coverage effect**:
    the combination is more common in cs.LG and cs.AI.
  - The other was not, so such directions still need human judgement.
