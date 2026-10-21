"""Tests of the aspect-level gap analysis: text rules, evidence store, analyser, API and review metrics.

Store/analyser/API tests are skipped when models/gap or models/opportunity have not
been built. Short sentences below are hand-written test inputs for the rules;
everything checked against "real" data comes from the built store and the raw snapshot.
"""

import csv
import json
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.opportunity_store import REQUIRED_FILES
from ml.gap_analysis import ANCHORED_MAX, GAP_TYPES, N_RELEVANT, WELL_COVERED, benjamini_hochberg, wilson
from ml.gap_aspects import (DatasetLookup, dataset_names, lexicon_aspects, normalise_whitespace, split_sentences,
                            statement_type)

SERVICE = Path(__file__).resolve().parents[1]
REAL = Settings.from_env()
QUOTE_SAMPLE = SERVICE / "data" / "gap" / "quote_check_sample.jsonl"
built = (REAL.gap_dir / "evidence.joblib").is_file() and all((REAL.opportunity_dir / f).is_file() for f in REQUIRED_FILES)
needs_store = pytest.mark.skipif(not built, reason="gap evidence store not built; run python -m ml.gap_evidence")

TITLE = "Language-guided grasp planning for household robots"
ABSTRACT = ("We study how large language models can translate natural-language instructions into grasp and motion "
            "plans for a mobile manipulator in household environments. The system grounds object references with a "
            "vision-language model, plans collision-free trajectories and is evaluated in simulation and on a real "
            "robot arm.")


# ---------------------------------------------------------------- text rules

def test_sentence_splitting_keeps_abbreviations_and_offsets():
    text, spans = split_sentences("We use e.g. fog and rain,  see Fig. 3.\nResults improve. Future work follows.")
    assert [text[a:b] for a, b in spans] == [
        "We use e.g. fog and rain, see Fig. 3.", "Results improve.", "Future work follows."]


@pytest.mark.parametrize("sentence, expected", [
    ("In future work, we plan to study domain adaptation.", "future_work"),
    ("Deployment in the wild remains underexplored.", "under_explored"),
    ("However, existing methods fail to generalize to fog.", "limitation_prior"),
    ("We overcome the limitations of prior approaches.", "limitation_addressed"),
    ("However, existing methods fail to address occlusion and suffer from noise.", "limitation_prior"),
    ("Results show that current models still struggle with night scenes.", "limitation_evaluated"),
    ("Our method is limited to daytime data.", "limitation_own"),
    ("The task is limited by sensor noise.", "limitation_unclear"),
    ("We propose a new planner.", None),
])
def test_statement_typing_rules(sentence, expected):
    assert statement_type(sentence) == expected


# Regression: real abstract sentences (arXiv ids given) that the first rules mistyped.
@pytest.mark.parametrize("arxiv_id, sentence, expected", [
    ("2507.10376", "The proposed model uses advanced sensor fusion techniques that dynamically adjust the contributions of "
                   "each sensor based on the current environmental condition, with radar compensating for visual sensor "
                   "limitations in poor visibility.", "limitation_addressed"),  # was limitation_own
    ("2603.19936", "In this study, we propose LIORNet, which eliminates these drawbacks and integrates the strengths of all "
                   "three paradigms.", "limitation_addressed"),  # was limitation_own
    ("2603.19936", "This design enables LIORNet to distinguish noise points from environmental structures without requiring "
                   "manual annotations, thereby overcoming the difficulty of snow labeling and the limitations of "
                   "single-principle approaches.", "limitation_addressed"),
    ("PhishXplain", "To address these limitations, we present PhishXplain (PXP), a real-time explainable phishing warning "
                    "system designed to augment existing detection mechanisms.", "limitation_addressed"),
    ("ContextualFusion", "To aid in our evaluation, we use the open-source simulator CARLA to create a multimodal "
                         "adverse-condition dataset called AdverseOp3D to address the shortcomings of existing datasets "
                         "being biased towards daytime and good-weather conditions.", "limitation_addressed"),
    # Still open, not addressed: the resolution verb is negated, still to come, or describes the evaluated systems.
    ("still open", "Our findings reveal limitations in the cultural understanding and adaptability of current VLMs that "
                   "need to be addressed toward more culturally inclusive models.", "limitation_evaluated"),
    ("evaluated", "Through a series of evaluations, we reveal significant limitations and problems of overconfidence of "
                  "state-of-the-art large multimodal language models in addressing ambiguity in their responses.",
     "limitation_evaluated"),
    ("contrast", "Unlike traditional heuristic or machine learning approaches that rely on static features and struggle to "
                 "adapt to evolving threats, our framework adapts online.", "limitation_prior"),  # was limitation_own
    ("compound", "In contrast, Task and Motion Planning (TAMP) systems are automated and excel at solving long-horizon "
                 "tasks, but they are difficult to apply to contact-rich tasks.", "limitation_unclear"),
    # Second review round: sentences shown as potential gaps by the first fix.
    ("SemiDDM-Weather", "In dealing with these two limitations, this paper presents a pioneering semi-supervised "
                        "all-in-one adverse weather removal framework built on the teacher-student network with a "
                        "Denoising Diffusion Model (DDM) as the backbone, termed SemiDDM-Weather.", "limitation_addressed"),
    ("FedDP-PALD", "However, existing methods face two problems: the information exchanged during training can reveal "
                   "whether a patient's data were used, and synthetic data meant to replace real records often fail to "
                   "preserve their predictive structure, which limits clinical use.", "limitation_prior"),
    ("ROCKER", "In this paper, we address this research gap by specifying a refinement operator, dubbed ROCKER, which we "
               "prove to be finite, proper and non-redundant.", "limitation_addressed"),
    ("review", "Notably, we organizes the review based on specific challenges and their corresponding solutions in "
               "different medical image analysis applications, so that technical applications are directly aligned with "
               "practical issues, addressing gaps in the current research landscape.", "limitation_addressed"),
    ("open gap kept", "However, most existing approaches have been primarily developed for mobile robots, leaving a "
                      "significant gap in research that addresses the unique challenges posed by mobile manipulators.",
     "under_explored"),
    ("performance gap", "Recent advances in multilingual representation learning aim to bridge the performance gap between "
                        "high- and low-resource languages, yet their ability to preserve affective meaning across "
                        "languages remains underexplored.", "under_explored"),
    ("generic future", "Our experiments provide a benchmark and guidance for future research and application of federated "
                       "learning in medical imaging contexts.", None),
    ("generic future", "We release our code and data to aid future work on detecting AI-generated content.", None),
    ("generic future", "Additionally, it offers insights into potential future research directions to advance event-based "
                       "sensor fusion for next-generation odometry applications.", None),
    ("ADUULM-360", "Discussing these results, we demonstrate common limitations of state-of-the-art methods, especially in "
                   "adverse weather conditions, which hopefully will inspire future research in this area.",
     "limitation_evaluated"),
    ("specific future", "For future work, we pointed out the need of pruned and quantised neural network models for "
                        "real-time applications in robotic ultrasound-guidance procedure.", "future_work"),
    ("specific future", "We leave the extension to multi-agent settings for future work.", "future_work"),
    ("generic survey", "Furthermore, we delineate critical research gaps and emerging challenges to guide future "
                       "investigations in securing object detection systems against adversarial threats.", None),
    ("survey addresses", "Furthermore, we identify and address main research gaps, providing valuable insights to guide "
                         "future research endeavors within the AI research community.", "limitation_addressed"),
    ("superiority claim", "Experiments in challenging simulated environments demonstrate that our approach solves complex "
                          "long-horizon tasks in highly cluttered environments that prior methods cannot handle.",
     "limitation_prior"),
    ("evaluated", "Evaluations of 13 state-of-the-art video-LLMs reveal that, despite strong performance on conventional "
                  "benchmarks, these models still struggle with streaming video understanding in embodied scenarios.",
     "limitation_evaluated"),
    ("evaluated", "Our experiments across three interleaved image-text models (i.e., OmniGen, ACE, and Show-o) and six "
                  "agentic frameworks (e.g., ChatDiT and LLM + SD) reveal that even state-of-the-art systems struggle with "
                  "consistency.", "limitation_evaluated"),
])
def test_statement_typing_regressions(arxiv_id, sentence, expected):
    assert statement_type(sentence) == expected, arxiv_id


def test_curated_aspects_and_dataset_names():
    text = "Evaluated in simulation and real-world experiments on the KITTI and nuScenes benchmarks with RMSE in real time."
    found = lexicon_aspects(text)
    assert {("setting", "simulation"), ("setting", "real_world"), ("setting", "real_time"), ("metric", "error")} <= found
    assert dataset_names(text) == {"KITTI", "nuScenes"}
    assert dataset_names("Results on our new dataset and the English corpus.") == set()
    lookup = DatasetLookup(["KITTI", "MS COCO"])
    assert lookup.find("SemanticKITTI differs from KITTI; MS COCO too.") == {"KITTI", "MS COCO"}


def test_wilson_interval_and_benjamini_hochberg():
    low, high = wilson(2, 100)
    assert 0.005 < low < 0.0056 and 0.069 < high < 0.071
    assert wilson(0, 0) == (0.0, 0.0)
    q = benjamini_hochberg([0.01, 0.04, 0.03, 0.5])
    assert list(np.round(q, 4)) == [0.04, 0.0533, 0.0533, 0.5]


# ---------------------------------------------------------------- evidence store

@pytest.fixture(scope="module")
def analyser():
    from ml.gap_analysis import GapAnalyzer
    from ml.opportunity import OpportunityEngine
    return GapAnalyzer(OpportunityEngine(REAL.opportunity_dir), REAL.gap_dir)


@pytest.fixture(scope="module")
def result(analyser):
    return analyser.analyse(TITLE, ABSTRACT)


@needs_store
def test_quotes_are_exact_text_of_the_original_abstracts(analyser):
    """Every stored statement of the sampled papers is a substring of the raw snapshot abstract."""
    sample = [json.loads(line) for line in QUOTE_SAMPLE.open(encoding="utf-8")]
    row_of = {str(i): r for r, i in enumerate(analyser.engine.ids)}
    checked = 0
    for item in sample:
        original = normalise_whitespace(item["abstract"])
        r = row_of[item["id"]]
        for s in analyser._statements_of(r):
            quote = str(analyser.statements["text"][s])
            start = int(analyser.statements["start"][s])
            assert original[start:start + len(quote)] == quote
            checked += 1
    assert checked > 0


@needs_store
def test_analysis_is_abstract_level_and_internally_consistent(analyser, result):
    assert result["evidenceLevel"] == "abstract" and result["relevantTotal"] == N_RELEVANT
    for a in result["wellCovered"]:
        assert a["relevantPapers"] >= WELL_COVERED
        assert a["interval95"][0] <= a["share"] <= a["interval95"][1]
    for g in result["inferredGaps"]:
        assert g["why"]
        if g["rule"].startswith("anchored"):
            assert g["inYourText"] and g["relevantPapers"] <= ANCHORED_MAX
        if "area" in g["rule"]:
            assert g["qValue"] < 0.05 and g["share"] < g["areaShare"]


@needs_store
def test_counts_match_the_evidence_matrix(analyser, result):
    scores, _ = analyser.engine.similarity_scores(f"{TITLE} {ABSTRACT}")
    relevant = np.argsort(-scores)[:N_RELEVANT]
    for a in result["wellCovered"] + result["inferredGaps"]:
        family, aspect_id = a["aspectId"].split(":", 1)
        col = analyser.col_index[(family, aspect_id)]
        assert a["relevantPapers"] == int(analyser.matrix_rows[relevant][:, col].sum())


@needs_store
def test_author_statements_come_only_from_relevant_papers(result):
    relevant_ids = {p["arxivId"] for p in result["relevantPapers"]}
    ranks = [q["paper"]["relevanceRank"] for qs in result["authorStatements"].values() for q in qs]
    assert all(1 <= r <= N_RELEVANT for r in ranks)
    for g in result["directlySupportedGaps"]:
        assert g["paperCount"] >= 1 and all(s["type"] in GAP_TYPES for s in g["statements"])
        assert all(s["paper"]["url"] == "https://arxiv.org/abs/" + s["paper"]["arxivId"] for s in g["statements"])
    assert relevant_ids


@needs_store
def test_own_wording_never_claims_a_gap_is_proven(result):
    disclaimer = "do not show that an aspect has not been studied"
    assert disclaimer in result["basis"].lower()
    own = json.dumps({k: result[k] for k in ("basis", "method", "limitations")}).lower().replace(disclaimer, "") + " ".join(
        g["why"].lower() for g in result["inferredGaps"])
    for forbidden in ("never been studied", "never been researched", "has not been studied", "proves", "confidence"):
        assert forbidden not in own


# ---------------------------------------------------------------- potential research gaps

PHISHING = ("Detecting phishing websites with machine learning",
            "We study phishing attacks and propose a classifier that uses URL and HTML features to detect malicious "
            "websites, protecting users against credential theft and improving browser security against attackers who "
            "imitate trusted login pages and steal passwords.")
CASES = {c["arxivId"]: c for c in json.loads((Path(__file__).parent / "fixtures" / "gap_regression_cases.json")
                                              .read_text(encoding="utf-8"))["cases"]}


def assert_heading_rules(g):
    """Specific aspects keep their label as heading; generic ones keep it, prefixed with the kind of evidence."""
    from ml.gap_analysis import COVERAGE_HEADING, GENERIC_HEADING_ASPECTS, TYPE_HEADING
    if g["aspect"] is None:
        return
    generic = g["aspect"]["family"] == "metric" or g["aspect"]["aspectId"] in GENERIC_HEADING_ASPECTS
    if not generic:
        assert g["heading"] == g["aspect"]["label"]
        return
    lead = TYPE_HEADING[g["statements"][0]["type"]] if g["statements"] else COVERAGE_HEADING
    assert g["heading"].startswith(f"{lead}: {g['aspect']['label']}")


@pytest.mark.parametrize("aspect, kind, terms, expected", [
    # Specific aspects are unchanged.
    ({"aspectId": "application:manipulation", "family": "application", "label": "Robot manipulation / grasping"},
     "under_explored", {"mobile manipulators"}, "Robot manipulation / grasping"),
    ({"aspectId": "application:medical", "family": "application", "label": "Medical / clinical"},
     None, set(), "Medical / clinical"),
    # Generic ones gain the kind of evidence and up to two shared terms.
    ({"aspectId": "metric:accuracy", "family": "metric", "label": "Accuracy"},
     "limitation_evaluated", {"privacy"}, "Limitation of evaluated systems: Accuracy (privacy)"),
    ({"aspectId": "metric:latency", "family": "metric", "label": "Latency / throughput / FPS"},
     None, set(), "Rarely mentioned in the closest abstracts: Latency / throughput / FPS"),
    ({"aspectId": "setting:multimodal", "family": "setting", "label": "Multimodal"},
     "limitation_own", {"multimodal", "icl", "context learning", "retrieval"},
     "Stated limitation: Multimodal (context learning, icl)"),  # "multimodal" is not repeated; at most two terms
    ({"aspectId": "application:networks", "family": "application", "label": "Networks / communications"},
     "future_work", {"intrusion detection"}, "Future work: Networks / communications (intrusion detection)"),
])
def test_generic_gap_headings_gain_context(aspect, kind, terms, expected):
    from ml.gap_analysis import _gap_heading
    assert _gap_heading(aspect, kind, terms) == expected


@needs_store
def test_generic_heading_wording_changes_nothing_else(analyser):
    """Regression: the federated-learning case showed a bare "Accuracy" heading."""
    result = analyser.analyse("Privacy-preserving federated learning for medical image segmentation",
                              "We propose a federated learning framework that trains medical image segmentation networks "
                              "across hospitals without sharing patient scans. Differential privacy noise is added to "
                              "model updates, and we study the trade-off between privacy budget and segmentation accuracy "
                              "on several public datasets.")
    accuracy = [g for g in result["potentialGaps"] if g["aspect"] and g["aspect"]["aspectId"] == "metric:accuracy"]
    assert accuracy and accuracy[0]["heading"] != "Accuracy"
    assert accuracy[0]["aspect"]["label"] == "Accuracy"  # the aspect itself is unchanged
    for g in result["potentialGaps"]:
        assert_heading_rules(g)


def assert_potential_gap_rules(analyser, result):
    """Every displayed potential gap is evidence-supported, connected to the text and labelled by the documented rules."""
    from ml.gap_analysis import MIN_SHARED_WORDS, RECENT_YEARS, UNCERTAINTY
    your_aspects = {a["aspectId"] for a in result["yourAspects"]}
    reference_year = int(np.max(analyser.engine.years))
    for g in result["potentialGaps"]:
        assert g["signals"] and g["explanation"] and g["uncertaintyLabel"] == UNCERTAINTY[g["uncertainty"]]
        assert_heading_rules(g)
        # Relevance: an aspect of the text, or >= MIN_SHARED_WORDS distinct words of its distinctive terms.
        if g["aspect"] is not None:
            assert g["aspect"]["aspectId"] in your_aspects
        else:
            assert len({w for t in g["sharedTerms"] for w in t.split()}) >= MIN_SHARED_WORDS
        # Evidence: only gap-type author statements from the relevant papers, quoted with their arXiv link.
        for s in g["statements"]:
            assert s["type"] in GAP_TYPES
            assert 1 <= s["paper"]["relevanceRank"] <= N_RELEVANT
            assert s["paper"]["url"] == "https://arxiv.org/abs/" + s["paper"]["arxivId"]
        # Coverage signal only from the anchored rule (the text's own aspect), never from the wider area alone.
        if "low_coverage" in g["signals"]:
            assert g["aspect"] is not None and g["coverage"]["relevantPapers"] <= ANCHORED_MAX
        # Uncertainty labels follow the documented rules; old evidence is kept with a warning.
        recent = g["latestYear"] is not None and g["latestYear"] >= reference_year - RECENT_YEARS
        if g["signals"] == ["author_statements", "low_coverage"]:
            assert g["uncertainty"] == "corroborated"
        elif g["signals"] == ["author_statements"]:
            assert g["uncertainty"] == ("indicative" if g["paperCount"] >= 2 or recent else "exploratory")
        else:
            assert g["uncertainty"] == "exploratory"
        if g["statementCount"] and not recent:
            assert any(n.startswith("Older evidence") for n in g["notes"])
        text = (g["explanation"] + " ".join(g["notes"])).lower()
        assert not any(w in text for w in ("unexplored", "unresolved", "never been", "definitely", "verified", "proves"))


@needs_store
def test_potential_gaps_follow_the_rules(analyser, result):
    assert_potential_gap_rules(analyser, result)
    screening = result["potentialGapsScreening"]
    assert screening["shown"] == len(result["potentialGaps"]) <= screening["candidates"]


@needs_store
def test_phishing_gets_no_off_topic_gap(analyser):
    """Regression: Medical / clinical (rarer than in the wider security area only) was shown as a gap."""
    result = analyser.analyse(*PHISHING)
    assert_potential_gap_rules(analyser, result)
    headings = {g["heading"] for g in result["potentialGaps"]}
    assert "Medical / clinical" not in headings
    area_only = [g for g in result["inferredGaps"] if g["rule"] == "area"]
    assert area_only and not headings & {g["label"] for g in area_only}
    assert result["potentialGapsScreening"]["excluded"]["rarerThanTheWiderAreaOnly"] == len(area_only)


@needs_store
@pytest.mark.parametrize("arxiv_id, unwanted", [
    ("2603.19936", {"Robot manipulation / grasping"}),                     # LiDAR snow removal for driving
    ("2507.10376", {"Robot manipulation / grasping"}),                     # radar-camera odometry in bad weather
    ("2603.19013", {"Autonomous driving", "LiDAR", "SLAM", "Navigation / mobile robots"}),  # hand-object pose
])
def test_held_out_papers_get_no_off_topic_gaps(analyser, arxiv_id, unwanted):
    """Regression on real abstracts, each excluded from its own evidence."""
    case = CASES[arxiv_id]
    result = analyser.analyse(case["title"], case["abstract"], exclude_id=arxiv_id)
    assert_potential_gap_rules(analyser, result)
    headings = [g["heading"] for g in result["potentialGaps"]]
    assert not set(headings) & unwanted
    assert len(headings) == len(set(headings)), "the same potential gap was split into several cards"


@needs_store
@pytest.mark.parametrize("arxiv_id", ["2603.19936", "2507.10376"])
def test_solution_sentences_are_not_stored_as_own_limitations(analyser, arxiv_id):
    """Regression: the LIORNet and Raci-Net solution sentences were stored as limitations of the paper's own approach."""
    row = int(np.where(analyser.engine.ids == arxiv_id)[0][0])
    types = [analyser.statement_types[int(analyser.statements["type"][s])] for s in analyser._statements_of(row)]
    assert types and "limitation_own" not in types and "limitation_addressed" in types


# ---------------------------------------------------------------- API

@pytest.fixture(scope="module")
def client():
    return TestClient(create_app(REAL))


@needs_store
def test_api_gap_analysis(client):
    response = client.post("/api/v1/gap-analysis", json={"title": TITLE, "abstract": ABSTRACT})
    assert response.status_code == 200
    body = response.json()
    assert body["evidenceLevel"] == "abstract"
    # Additive change: every original field is still returned, next to the new potential-gap fields.
    assert {"basis", "relevantPapers", "relevantTotal", "recognisedTerms", "wideArea", "yourAspects", "wellCovered",
            "methodTerms", "authorStatements", "directlySupportedGaps", "inferredGaps", "method", "limitations",
            "potentialGaps", "potentialGapsScreening", "uncertaintyLabels"} <= set(body)
    health = client.get("/health").json()
    assert health["gapAnalysisLoaded"] is True and health["opportunityAnalysisLoaded"] is True


def test_api_gap_analysis_rejects_invalid_input(client):
    response = client.post("/api/v1/gap-analysis", json={"title": TITLE, "abstract": "too short"})
    assert response.status_code == 400 and "abstract" in response.json()["fieldErrors"]


def test_missing_gap_store_is_a_503(tmp_path):
    client = TestClient(create_app(Settings(model_path=REAL.model_path, model_info_path=REAL.model_info_path,
                                            reports_dir=REAL.reports_dir, opportunity_dir=REAL.opportunity_dir,
                                            gap_dir=tmp_path)))
    assert client.get("/health").json()["gapAnalysisAvailable"] is False
    response = client.post("/api/v1/gap-analysis", json={"title": TITLE, "abstract": ABSTRACT})
    assert response.status_code == 503 and "not available" in response.json()["message"]


@needs_store
def test_gap_evaluation_reports_review_status_without_invented_metrics(client):
    body = client.get("/api/v1/gap-analysis/evaluation").json()
    assert body["evidenceLevel"] == "abstract"
    stats = body["evidenceStore"]["statements"]
    assert stats["verified_exact_substrings"] == stats["total"]
    if not body["manualReview"]["labelled"]:
        assert "NOT measured" in body["manualReview"]["status"] and "metrics" not in body["manualReview"]


# ---------------------------------------------------------------- review metrics

def test_metrics_are_not_reported_without_labels(tmp_path):
    from ml.gap_metrics import compute
    (tmp_path / "a_statements.csv").write_text(
        "item,arxiv_id,url,title,predicted_type,quote,label_type_correct_yes_no,label_true_type,label_quote_is_exact_yes_no,notes\n"
        "A001,x,u,t,future_work,q,,,,\n", encoding="utf-8")
    labelled, _ = compute(tmp_path)
    assert labelled is False


def test_review_sheets_with_labels_are_never_overwritten(tmp_path):
    from ml.gap_review import main
    (tmp_path / "a_statements.csv").write_text(
        "item,arxiv_id,url,title,predicted_type,quote,label_type_correct_yes_no,label_true_type,label_quote_is_exact_yes_no,notes\n"
        "A001,x,u,t,future_work,q,yes,,,\n", encoding="utf-8")
    before = (tmp_path / "a_statements.csv").read_bytes()
    with pytest.raises(SystemExit, match="refusing to overwrite"):
        main(["--input", "unused.json", "--out", str(tmp_path)])
    assert (tmp_path / "a_statements.csv").read_bytes() == before


def test_metrics_use_only_labelled_rows(tmp_path):
    from ml.gap_metrics import compute
    header = ["item", "arxiv_id", "url", "title", "predicted_type", "quote", "label_type_correct_yes_no",
              "label_true_type", "label_quote_is_exact_yes_no", "notes"]
    rows = [["A1", "x", "u", "t", "future_work", "q", "yes", "", "yes", ""],
            ["A2", "x", "u", "t", "future_work", "q", "no", "none", "yes", ""],
            ["A3", "x", "u", "t", "limitation_own", "q", "yes", "", "", ""],
            ["A4", "x", "u", "t", "limitation_own", "q", "", "", "", ""]]
    with (tmp_path / "a_statements.csv").open("w", newline="", encoding="utf-8") as out:
        csv.writer(out).writerows([header] + rows)
    labelled, metrics = compute(tmp_path)
    assert labelled is True
    overall = metrics["statement_type_precision"]["overall"]
    assert overall["labelled"] == 3 and overall["value"] == pytest.approx(2 / 3, abs=1e-4)
    assert overall["reliable"] is False
    assert metrics["statement_type_precision"]["future_work"]["value"] == 0.5
