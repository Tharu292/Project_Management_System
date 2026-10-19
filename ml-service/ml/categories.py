"""Human-readable names of the arXiv categories the classifier knows (no heavy imports)."""

CATEGORY_NAMES = {
    "cs.CV": "Computer Vision",
    "cs.CL": "Computation & Language (NLP)",
    "cs.CR": "Cryptography & Security",
    "cs.RO": "Robotics",
    "cs.DB": "Databases",
}


def category_name(code):
    return CATEGORY_NAMES.get(code, code)
