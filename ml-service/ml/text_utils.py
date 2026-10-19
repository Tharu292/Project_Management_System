"""Text cleaning shared by data preparation, training and (later) the prediction API.

Training and prediction must turn a paper into model input in exactly the same
way, so this module is the only place that does it.
"""

import re

# arXiv category codes such as "cs.CV" or "math.OC". They are removed so the
# label can never leak into the features, even if an author wrote it in the text.
_CATEGORY_CODE = re.compile(
    r"\b(?:cs|math|stat|eess|econ|physics|astro-ph|cond-mat|q-bio|q-fin|nlin)\.[A-Za-z]{2,}\b"
)
# Inline or display LaTeX maths: "$x^2$", "$$...$$".
_LATEX_MATH = re.compile(r"\$\$.*?\$\$|\$[^$]*\$", re.DOTALL)
_WHITESPACE = re.compile(r"\s+")
_NON_ALPHANUMERIC = re.compile(r"[^a-z0-9]+")


def clean_text(text: str) -> str:
    """Removes category codes and LaTeX maths and collapses whitespace."""
    text = _CATEGORY_CODE.sub(" ", text or "")
    text = _LATEX_MATH.sub(" ", text)
    return _WHITESPACE.sub(" ", text).strip()


def build_text(title: str, abstract: str) -> str:
    """The model input for one paper: its title followed by its abstract."""
    return f"{clean_text(title)} {clean_text(abstract)}".strip()


def normalise_title(title: str) -> str:
    """A key for finding the same paper submitted twice under different ids."""
    return _NON_ALPHANUMERIC.sub(" ", (title or "").lower()).strip()
