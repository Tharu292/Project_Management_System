# Aspect-level research gap analysis (abstract-level evidence)

Component 3, module 5. A student enters a research title and abstract. The
analysis looks at the most similar real arXiv papers and shows three separate things:

1. **Potential Research Gaps Identified:** only candidates that are supported
   by evidence *and* connected to the student's text. Each one has an
   explanation, quoted author statements with arXiv links, cautions, and an
   uncertainty label (see [Potential research gaps](#potential-research-gaps)).
2. **Coverage context (not gaps):**
   - well-covered aspects;
   - aspects that are rarer among the closest abstracts than in the wider topic
     area. This usually reflects how a subfield differs from its neighbours, so
     these are shown as context only.
3. **All author statements (raw):** every candidate limitation, under-explored
   and future-work sentence, **quoted exactly** from the original abstracts and
   grouped by type. Not every statement is a gap. For example, a limitation of
   prior work usually describes the problem the paper itself addresses.

**No new research titles are generated.** Nothing is claimed to be unexplored or
unresolved.

## Evidence level: abstracts only

The Cornell arXiv snapshot holds **metadata only**: title, abstract, authors,
comments, journal reference, DOI and categories. **There is no full paper text.**
This has three consequences:
- Every result is labelled **abstract-level evidence**.
- An abstract that doesn't mention an aspect does **not** show that the paper, or
  the field, didn't study it.
- Most limitation and future-work discussion is in full papers. Abstracts state
  future work rarely: a cue phrase appears in only **3.7%** of the 334,582
  corpus abstracts.

## Build (after the opportunity index: `docs/opportunities.md`)

```powershell
cd ml-service
.\.venv\Scripts\Activate.ps1
python -m ml.gap_evidence --input data/raw/arxiv-metadata-oai-snapshot.json   # evidence store
python -m ml.gap_review   --input data/raw/arxiv-metadata-oai-snapshot.json   # manual review sheets
python -m ml.gap_metrics                                                      # after labelling
```

Outputs:
- `models/gap/evidence.joblib` and `data/gap/` are git-ignored.
- `reports/gap/` holds the statistics, review sheets and status, and is committed.
- **Nothing produced by the classifier or the opportunity analysis is changed.**
  Their index and topic model are only *read*.

## Method

### Aspects (`ml/gap_aspects.py`, lexicon version in `LEXICON_VERSION`)

| Family | Source |
|---|---|
| Evaluation settings (e.g. real-world, simulation, zero-shot, cross-domain, multilingual, real-time, on-device, adversarial, human evaluation, privacy, fairness) | **Curated word list** with synonyms |
| Evaluation metrics (e.g. accuracy, F1, mAP, IoU, BLEU/ROUGE, success rate, RMSE, latency) | **Curated word list** |
| Application domains (e.g. medical, autonomous driving, UAV, agriculture, household, education, legal) | **Curated word list** |
| Datasets / benchmarks | **Extracted** from abstracts ("on the KITTI and nuScenes benchmarks"). Names found in at least 5 papers are kept; matching is exact and case-sensitive. |
| Method terms | **Data-driven:** the text's most distinctive TF-IDF terms, and how many close abstracts contain them |

The curated lists are a documented design choice. They will miss synonyms, which
is one reason absence is never treated as proof.

### Author statements

- Original abstracts are split into sentences; the splitter does not break after
  abbreviations such as "e.g.", "et al." or "Fig.".
- Cue-phrase rules type each sentence:
  - **future work** ("future work", "we plan to", "remains an open problem");
    - Generic remarks such as "guidance for future research", "to aid future
      work on…" or "insights into … future directions" are ignored, because
      they name no open problem. A limitation in the same sentence is still typed.
  - **under-explored** ("remains underexplored", "little attention", "has rarely been studied").
    - "We address this research gap" and "addressing gaps in the current
      research landscape" are typed as *addressed by the paper*.
    - A survey's "we identify research gaps…" names no gap and is ignored.
  - **limitation**, with a rule-based guess of whose. The rules are checked in this order:
    - *addressed by the paper*: a resolution verb in any form (address,
      overcome, eliminate, compensate for, mitigate, alleviate, resolve, tackle,
      circumvent; or solve, bridge, fill, close or deal with, followed by a
      problem noun).
      For example, "we propose LIORNet, which eliminates these drawbacks", or
      "radar compensating for visual sensor limitations".
      - A verb that is negated or still to come doesn't count: "fail to
        address", "need to be addressed", "yet to".
      - Nor does one that describes the evaluated systems, such as
        "…limitations of current models in addressing ambiguity".
    - *prior work the paper improves on*: "our approach solves … tasks that
      prior methods cannot handle";
    - *systems the paper evaluated*: "results show that current models still
      struggle…" or "evaluations of 13 video-LLMs reveal that…";
    - *prior work*: "existing methods fail…", or "unlike traditional … approaches";
    - *the paper's own*: "our method is limited to…";
    - *unclear*.
- **Quotes are exact.** Each quote is the original abstract text with only
  whitespace normalised. Every one of them is checked as an exact substring when
  the store is built, and again by the tests against original abstracts from the
  raw file.

### Coverage and inferred gaps (`ml/gap_analysis.py`)

- **Relevant set:** the 100 most similar abstracts, from the existing TF-IDF retrieval.
- **Wider area:** the other papers covering the text's two strongest NMF topics.
- **For each aspect:** *k* of 100 relevant abstracts mention it, with a Wilson
  95% interval, compared with its rate in the wider area.
- **Well covered:** mentioned by at least 10 of the 100.
- **Inferred under-representation:**
  - *anchored:* your text mentions the aspect, but at most 3 of the 100 closest
    abstracts do;
  - *area:* rarer among the closest abstracts than in the wider area, by an
    **exploratory** one-sided binomial test with Benjamini–Hochberg q < 0.05, for
    aspects found in at least 5 of every 100 papers of the area.
- **Statistics are exploratory.** The intervals and tests describe the abstracts;
  they are **not proof of a research gap**. The two rules are not independent
  evidence, and the relevant set is not a random sample.
- **The area rule alone is context, not a gap.** In testing, it flagged aspects
  that were off-topic for the text, for example:
  - Medical/Clinical for phishing detection;
  - Autonomous driving and SLAM for hand-object pose estimation.

  An aspect that is common in the broad area but rare in the closest papers
  usually belongs to a neighbouring subfield.

### Potential research gaps

A candidate is shown only if it has **evidence** and a **connection to the text**.

**Evidence** is either or both of:
- an author statement of type future work, under-explored, own limitation, or
  limitation of evaluated systems;
- the anchored coverage rule: the text's own aspect, mentioned by at most 3 of
  the 100 closest abstracts.

Statements typed as limitations of prior work, limitations the paper says it
addresses, or limitations with an unclear owner never count as evidence. They
remain in the raw statement list.

**Connection to the text:**
- The statement must mention an aspect found in the student's text, or share at
  least 2 distinct words with the text's 15 most distinctive TF-IDF terms.
- Only an aspect found in the text can be attributed to a gap. This stops a
  sentence from tagging every aspect it happens to mention.
- Being among the 30 closest papers is shown and used for ordering. **It is a
  relevance signal, never sufficient on its own.**

The response reports how many statements were screened out, and for which reason.

**Headings.** A specific aspect, such as "Robot manipulation / grasping", is its own card heading.
- Generic aspects get context: every evaluation metric, plus Multimodal,
  Computational efficiency, Scalability, Real-time, Robustness, Safety and
  Networks.
  - The heading starts with the kind of evidence from the closest supporting
    statement. With no statement, it starts with "Rarely mentioned in the
    closest abstracts".
  - It ends with up to 2 shared terms, for example "Limitation of evaluated
    systems: Accuracy (privacy)".
- This changes wording only. The aspect, evidence, quotes, labels and
  ordering stay the same.

**Uncertainty labels.** These are rule-based categories, not probabilities.

| Label | Rule |
|---|---|
| **Corroborated signal** | An author statement *and* low coverage in the closest abstracts point to the same aspect. The agreement does **not** establish that the problem is unresolved. |
| **Indicative signal** | Author statements in 2 or more of the closest papers, or one from the last 3 years. |
| **Exploratory signal** | One signal only: few close abstracts mention an aspect of the text, or a single author statement older than 3 years. |

No higher label exists, because evidence from abstracts can't support one.

**Cautions** are attached to each candidate:
- **Older evidence is kept, never discarded:**
  - when the most recent supporting statement is more than 3 years older than
    the newest corpus year, the card says it may already have been addressed by
    later work;
  - when only some supporting statements are that old, it says so.
- **Under-explored statements:** the stating paper works on the topic itself.
- **Limitations of evaluated systems:** they describe those systems at the time
  of the paper.
- **Coverage signals:** few mentions in abstracts do not show that the aspect
  was not studied.

## Validation

**Automatic, always run (tests):**
- quotes are exact substrings of the original abstracts;
- coverage counts equal the evidence matrix;
- the anchored and area rules hold for every inferred gap;
- author statements come only from the relevant papers;
- links are well formed;
- the app's own wording never claims a gap is proven;
- every potential gap satisfies the evidence, relevance and labelling rules, including on real held-out
  abstracts for the reported failure cases (phishing, LIORNet, Raci-Net, GenHOI);
- metrics are refused without labels, and labelled review sheets are never overwritten.

**Manual review (`reports/gap/review/`):**

| Sheet | What to label | Gives |
|---|---|---|
| `a_statements.csv` (~200, stratified by type) | Is the predicted type right? What is the true type? Is the quote exact? | Statement-type precision per type |
| `b_datasets.csv` (100) | Is the name a dataset or benchmark? | Dataset-extraction precision |
| `c_aspects.csv` (100) | Does the paper really concern the aspect? | Aspect-match precision |
| `d_case_studies.csv` (the displayed potential gaps for 8 held-out 2026 papers) | Is each one relevant and supported, plausible, not supported, or unsure? | Judgement distribution overall and per uncertainty label |
| `e_recall_sentences.csv` (300 random sentences) | The true type, or none | Recall of statement detection |

`python -m ml.gap_review` refuses to overwrite a review folder that already
contains labels.

After labelling, run `python -m ml.gap_metrics`:
- It uses **only labelled rows**, reports Wilson 95% intervals, and marks
  estimates from fewer than 30 rows as not reliable.
- **Until labels exist, precision, recall and gap-identification accuracy are NOT
  measured,** and the app says so.
- The classifier's macro-F1 is not evidence for this feature.

## Limitations

- Abstract-level only. See above.
- **Cue-phrase typing is approximate,** especially *whose* limitation it is. In
  random samples, most limitation sentences had an unclear owner. The
  "addressed" rule trades recall for precision. A sentence such as "approaches
  for mitigating hallucinations" can be typed as addressed, which hides it
  from the potential gaps.
- **The relevance gate can hide genuine gaps.** It works on shared aspects and
  words, so a statement that describes a related problem in different words
  is not shown as a potential gap. It remains in the raw statements.
- **Curated lists:** they miss synonyms, and broad terms such as "students"
  (education) or "simulation" can match unrelated uses.
- **Dataset extraction:**
  - it finds names written before "dataset" or "benchmark", plus later exact
    mentions of names found that way;
  - aliases (COCO / MS COCO) count separately;
  - some extracted names are not datasets.
- **Corpus bias:** arXiv only, five categories, from 2015, about half Computer Vision.
- **Limited evidence for some topics:** "stated by authors" findings are
  necessarily few for topics whose abstracts rarely state limitations.

## Future extension: full-text evidence (not implemented)

Explicit limitation and future-work *sections* exist only in full papers. A
later version could:
1. download the PDFs of the top few relevant papers on demand, from arXiv,
   respecting its rate limits and terms;
2. parse them, for example with `pypdf`;
3. extract the "Limitations", "Future Work" and "Conclusion" sections;
4. quote them with page references.

This needs network access to arxiv.org, a new dependency, extra time per
analysis (roughly 5–20 s), and its own precision review. Until then, all
evidence stays abstract-level.
