"""Unit tests for the pure helper functions of the ML pipeline.

The strings and arrays here are minimal hand-written test inputs that exercise
the logic. They are not research data and are never used for any reported result.
"""

import numpy as np
import pytest
from scipy.stats import binomtest
from sklearn.metrics import f1_score

from ml.model_card import change, p_text
from ml.prepare_data import sampling_key
from ml.text_utils import build_text, clean_text, normalise_title
from ml.train_classifier import MAIN_MODEL, check_no_leakage, mcnemar_svm_vs_nb
from ml.train_classifier import test_metrics as compute_test_metrics  # renamed so pytest does not collect it
from ml.trends import display_label, merge_same_concept, word_set, year_list


# ---------------------------------------------------------------- text cleaning

def test_clean_text_removes_category_codes_and_latex():
    text = r"We study cs.CV and math.OC with $x^2$ and $$\alpha + \beta$$ terms."
    assert clean_text(text) == "We study and with and terms."


def test_clean_text_keeps_ordinary_abbreviations():
    assert clean_text("e.g. U.S. data") == "e.g. U.S. data"


def test_build_text_joins_cleaned_title_and_abstract():
    assert build_text("  A  Title ", "An   abstract.\n") == "A Title An abstract."


def test_normalise_title_ignores_case_and_punctuation():
    assert normalise_title("Deep  Learning: A Survey!") == normalise_title("deep learning - a survey")


# ---------------------------------------------------------------- sampling and leakage

def test_sampling_key_is_deterministic_and_seed_dependent():
    assert sampling_key(42, "2101.00001") == sampling_key(42, "2101.00001")
    assert sampling_key(42, "2101.00001") != sampling_key(43, "2101.00001")


def test_leakage_check_passes_for_disjoint_splits():
    papers = [{"id": "1", "title": "Alpha"}, {"id": "2", "title": "Beta"}]
    assert check_no_leakage(papers, [0], [1]) == {"shared_ids": 0, "test_titles_seen_in_train": 0}


def test_leakage_check_stops_on_shared_title():
    papers = [{"id": "1", "title": "Same Title"}, {"id": "2", "title": "same title!"}]
    with pytest.raises(SystemExit):
        check_no_leakage(papers, [0], [1])


# ---------------------------------------------------------------- evaluation

def test_test_metrics_match_sklearn():
    y_true = np.array(["a", "a", "b", "b", "c", "c"])
    y_pred = np.array(["a", "b", "b", "b", "c", "a"])
    m = compute_test_metrics(y_true, y_pred, ["a", "b", "c"])
    assert m["accuracy"] == pytest.approx(4 / 6)
    assert m["macro_f1"] == pytest.approx(f1_score(y_true, y_pred, average="macro"))
    assert m["per_class"]["b"]["recall"] == pytest.approx(1.0)


def test_mcnemar_counts_only_discordant_papers():
    y = np.array(["a"] * 10)
    svm = np.array(["a"] * 8 + ["b"] * 2)            # wrong on the last two
    nb = np.array(["b"] * 5 + ["a"] * 3 + ["b"] * 2)  # wrong on the first five and the last two
    result = mcnemar_svm_vs_nb(y, {MAIN_MODEL: (None, svm), "multinomial_nb": (None, nb)})
    assert (result["only_svm_correct"], result["only_nb_correct"]) == (5, 0)
    assert result["p_value"] == pytest.approx(binomtest(5, 5, 0.5).pvalue)
    assert result["significant_at_0.05"] == (result["p_value"] < 0.05)


def test_mcnemar_without_discordant_papers_is_not_significant():
    y = np.array(["a", "b"])
    result = mcnemar_svm_vs_nb(y, {MAIN_MODEL: (None, y), "multinomial_nb": (None, y)})
    assert result["p_value"] == 1.0 and not result["significant_at_0.05"]


def test_model_card_wording_follows_the_numbers():
    assert change(0.009) == "falls by 0.9 points"
    assert change(-0.02) == "rises by 2.0 points"
    assert change(0.0001) == "essentially unchanged"
    assert p_text(0.0003) == "p < 0.001"
    assert p_text(0.358) == "p = 0.358"


# ---------------------------------------------------------------- keyword merging and labels

def test_year_list():
    assert year_list("2018-2019") == [2018, 2019]
    assert year_list("2020") == [2020]


def test_word_set_ignores_plurals_and_based_suffix():
    assert word_set("llms") == word_set("llm") == word_set("llm-based")
    # A hyphenated compound stays one word, so different concepts are not merged.
    assert not word_set("language models") <= word_set("vision-language models")


def _candidate(j, term, base=0.0, recent=0.1):
    return {"term": term, "base_share": base, "recent_share": recent, "log_ratio": 1.0, "_j": j}


def test_merge_same_concept_by_words_and_by_shared_papers():
    papers = {0: {1, 2, 3, 4}, 1: {1, 2, 3, 4, 5}, 2: {1, 2, 3}, 3: {10, 11}}
    candidates = [_candidate(0, "large language"), _candidate(1, "language models"),
                  _candidate(2, "llms"), _candidate(3, "text-to-sql")]
    kept = merge_same_concept(candidates, papers.get, k=5)
    assert [k["term"] for k in kept] == ["large language", "text-to-sql"]
    assert kept[0]["similar_terms"] == ["language models", "llms"]


def test_merge_same_concept_respects_k():
    papers = {i: {i} for i in range(5)}
    kept = merge_same_concept([_candidate(i, f"term{i}") for i in range(5)], papers.get, k=2)
    assert [k["term"] for k in kept] == ["term0", "term1"]


def test_display_label_repairs_fragments_but_never_narrows():
    fragment = {"term": "large language", "base_share": 0.0, "recent_share": 0.10, "log_ratio": 2.0,
                "similar_terms": ["language models"], "similar_shares": {"language models": (0.0, 0.10)}}
    assert display_label(fragment) == "large language models"
    broader = {"term": "prompt", "base_share": 0.0, "recent_share": 0.07, "log_ratio": 2.0,
               "similar_terms": ["prompt injection"], "similar_shares": {"prompt injection": (0.0, 0.01)}}
    assert display_label(broader) == "prompt"
