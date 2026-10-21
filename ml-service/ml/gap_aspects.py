"""Aspect vocabulary, sentence splitting and statement typing for the aspect-level gap analysis.

Everything here works on ABSTRACT text only. Three kinds of aspects are matched:

* evaluation settings, metrics and application domains: curated, versioned word
  lists (LEXICON_VERSION). They are a documented design choice and will miss
  synonyms; a missing match never means an aspect was not studied;
* datasets/benchmarks: names extracted from abstracts with explicit patterns
  ("... on the KITTI dataset", "COCO and LVIS benchmarks");
* candidate author statements: sentences typed by explicit cue patterns as
  future work, under-explored topic, or limitation (with a rule-based guess of
  whose limitation it is, and whether the paper says it addresses it). The typing
  is automatic and can be wrong.
"""

import re
from functools import lru_cache

LEXICON_VERSION = "2026-10-21.3"

# --------------------------------------------------------------------- curated aspect lists
# id: (label, [regular-expression alternatives, matched case-insensitively on word boundaries])

SETTINGS = {
    "real_world": ("Real-world evaluation / deployment", [r"real[- ]world (?:deployment|experiments?|evaluation|settings?|data|environments?|conditions)", r"deployed", r"in the wild", r"field (?:tests?|trials?|experiments?)"]),
    "simulation": ("Simulation", [r"simulat(?:ion|ions|ed|or|ors)"]),
    "zero_shot": ("Zero-shot", [r"zero[- ]shot"]),
    "few_shot": ("Few-shot", [r"few[- ]shot"]),
    "cross_domain": ("Cross-domain / domain shift", [r"cross[- ]domain", r"domain (?:shift|adaptation|generali[sz]ation)", r"out[- ]of[- ]distribution", r"\bOOD\b"]),
    "multilingual": ("Multilingual / cross-lingual", [r"multi[- ]?lingual", r"cross[- ]lingual"]),
    "low_resource": ("Low-resource", [r"low[- ]resource"]),
    "real_time": ("Real-time", [r"real[- ]time"]),
    "edge": ("On-device / edge / embedded", [r"on[- ]device", r"edge (?:devices?|computing|deployment)", r"embedded (?:devices?|systems?|platforms?)", r"mobile devices?", r"resource[- ]constrained"]),
    "adversarial": ("Adversarial robustness", [r"adversarial (?:attacks?|examples?|robustness|perturbations?)"]),
    "robustness": ("Robustness / noise", [r"robustness", r"noisy (?:data|labels|inputs?)", r"corruptions?"]),
    "human_eval": ("Human evaluation / user study", [r"human evaluations?", r"user stud(?:y|ies)", r"human (?:participants|subjects|raters|annotators)"]),
    "long_horizon": ("Long-horizon tasks", [r"long[- ]horizon"]),
    "open_vocab": ("Open-vocabulary / open-world", [r"open[- ]vocabulary", r"open[- ]world", r"open[- ]set"]),
    "privacy": ("Privacy", [r"privacy", r"privacy[- ]preserving", r"differential(?:ly)? priva(?:cy|te)"]),
    "fairness": ("Fairness / bias", [r"fairness", r"\bbias(?:es)? (?:mitigation|in)\b", r"demographic"]),
    "explainability": ("Interpretability / explainability", [r"interpretab(?:le|ility)", r"explainab(?:le|ility)", r"\bXAI\b"]),
    "efficiency": ("Computational efficiency", [r"computational (?:cost|efficiency|overhead)", r"inference (?:speed|time|latency)", r"lightweight", r"energy (?:consumption|efficiency|efficient)"]),
    "scalability": ("Scalability", [r"scalab(?:le|ility)", r"large[- ]scale"]),
    "uncertainty": ("Uncertainty quantification", [r"uncertainty (?:estimation|quantification|calibration)", r"calibrat(?:ed|ion)"]),
    "safety": ("Safety", [r"safety", r"safe (?:exploration|control|navigation|reinforcement)"]),
    "multimodal": ("Multimodal", [r"multi[- ]?modal"]),
    "self_supervised": ("Self-/unsupervised learning", [r"self[- ]supervised", r"unsupervised"]),
    "continual": ("Continual / incremental learning", [r"continual learning", r"lifelong learning", r"incremental learning", r"catastrophic forgetting"]),
    "federated": ("Federated / distributed learning", [r"federated"]),
    "benchmark_new": ("New benchmark or dataset released", [r"(?:we|this paper) (?:introduce|present|release|propose|construct|build|collect)s? (?:a |the )?(?:new |novel |large[- ]scale )?(?:benchmark|dataset|corpus)"]),
    "reproducibility": ("Reproducibility / open source", [r"reproducib(?:le|ility)", r"open[- ]source", r"code (?:is|will be) (?:publicly )?available"]),
}

METRICS = {
    "accuracy": ("Accuracy", [r"accuracy"]),
    "f1": ("F1 score", [r"\bF1\b", r"F-?score", r"F-?measure"]),
    "precision_recall": ("Precision / recall", [r"precision", r"recall"]),
    "auc": ("AUC / ROC", [r"\bAUC\b", r"\bROC\b", r"\bAUROC\b"]),
    "map": ("mAP / average precision", [r"\bmAP\b", r"average precision"]),
    "iou": ("IoU / mIoU", [r"\bm?IoU\b", r"intersection[- ]over[- ]union"]),
    "bleu_rouge": ("BLEU / ROUGE / METEOR", [r"\bBLEU\b", r"\bROUGE(?:-[L12])?\b", r"\bMETEOR\b", r"\bchrF\b"]),
    "perplexity": ("Perplexity", [r"perplexity"]),
    "psnr_ssim": ("PSNR / SSIM", [r"\bPSNR\b", r"\bSSIM\b", r"\bLPIPS\b"]),
    "fid": ("FID / Inception score", [r"\bFID\b", r"inception score"]),
    "success_rate": ("Success rate", [r"success rates?"]),
    "error": ("Error (RMSE / MAE / ATE)", [r"\bRMSE\b", r"\bMAE\b", r"\bATE\b", r"mean (?:squared|absolute) error", r"localization error"]),
    "latency": ("Latency / throughput / FPS", [r"latency", r"throughput", r"\bFPS\b", r"frames per second"]),
    "wer": ("Word error rate", [r"\bWER\b", r"word error rates?"]),
    "attack_success": ("Attack success rate", [r"attack success rates?", r"\bASR\b"]),
    "detection_rate": ("Detection / false-positive rate", [r"detection rates?", r"false[- ]positive rates?", r"false alarm"]),
}

APPLICATIONS = {
    "medical": ("Medical / clinical", [r"medical", r"clinical", r"patients?", r"diagnos(?:is|tic)", r"radiolog(?:y|ical)", r"\bMRI\b", r"\bCT (?:scans?|images?)\b", r"histopatholog"]),
    "healthcare": ("Healthcare / EHR", [r"healthcare", r"health ?care", r"electronic health records?", r"\bEHRs?\b"]),
    "autonomous_driving": ("Autonomous driving", [r"autonomous (?:driving|vehicles?)", r"self[- ]driving", r"driver assistance"]),
    "uav": ("UAV / drones / aerial", [r"\bUAVs?\b", r"drones?", r"unmanned aerial", r"aerial (?:images?|imagery|robots?)", r"quadrotors?"]),
    "remote_sensing": ("Remote sensing / satellite", [r"remote sensing", r"satellite (?:images?|imagery)", r"hyperspectral"]),
    "agriculture": ("Agriculture", [r"agricultur", r"crops?", r"farming", r"plant (?:disease|phenotyping)"]),
    "manufacturing": ("Manufacturing / industrial", [r"manufacturing", r"industrial", r"defect detection", r"factory"]),
    "household": ("Household / domestic", [r"household", r"domestic", r"home environments?", r"kitchen"]),
    "surgery": ("Surgery", [r"surgical", r"surgery"]),
    "underwater": ("Underwater / marine", [r"underwater", r"marine"]),
    "space": ("Space", [r"spacecraft", r"planetary", r"\bspace robotics\b", r"lunar", r"martian"]),
    "education": ("Education", [r"education(?:al)?", r"students?", r"learners", r"tutoring"]),
    "legal": ("Legal", [r"legal", r"law(?:s|yers?)?\b", r"court"]),
    "finance": ("Finance", [r"financ(?:e|ial)", r"stock", r"banking", r"fraud"]),
    "social_media": ("Social media", [r"social media", r"twitter", r"tweets?", r"reddit"]),
    "code": ("Source code / software", [r"source code", r"code generation", r"software (?:engineering|vulnerabilit)", r"programs? synthesis"]),
    "iot": ("IoT / smart devices", [r"\bIoT\b", r"internet of things", r"smart (?:home|devices?|city|cities)"]),
    "blockchain": ("Blockchain / smart contracts", [r"blockchains?", r"smart contracts?", r"cryptocurrenc"]),
    "networks": ("Networks / communications", [r"network traffic", r"wireless", r"\b5G\b", r"\b6G\b", r"intrusion detection"]),
    "cloud": ("Cloud / data centres", [r"cloud (?:computing|services?|platforms?)", r"data cent(?:er|re)s?", r"serverless"]),
    "documents": ("Documents / OCR", [r"\bOCR\b", r"document (?:images?|understanding|analysis)", r"handwrit"]),
    "speech": ("Speech / audio", [r"speech", r"spoken", r"audio"]),
    "video_surveillance": ("Video surveillance / security cameras", [r"surveillance", r"\bCCTV\b"]),
    "biometrics": ("Biometrics / faces", [r"face recognition", r"facial", r"biometric", r"fingerprints?"]),
    "low_resource_lang": ("Low-resource or non-English languages", [r"low[- ]resource languages?", r"(?:Arabic|Chinese|Hindi|Bengali|Swahili|Urdu|Sinhala|Tamil|Vietnamese|Indonesian|Persian|African) (?:language|text|speech)"]),
    "manipulation": ("Robot manipulation / grasping", [r"manipulat(?:ion|or)", r"grasp(?:ing)?"]),
    "navigation": ("Navigation / mobile robots", [r"navigation", r"mobile robots?", r"legged robots?", r"quadruped", r"humanoid"]),
    "databases": ("Databases / queries", [r"\bSQL\b", r"query (?:processing|optimi[sz]ation)", r"database"]),
}

FAMILIES = {"setting": SETTINGS, "metric": METRICS, "application": APPLICATIONS}
FAMILY_LABELS = {"setting": "Evaluation setting", "metric": "Evaluation metric", "application": "Application domain",
                 "dataset": "Dataset / benchmark"}


@lru_cache(maxsize=1)
def lexicon_matcher():
    """One compiled alternation per family; the named group tells which aspect matched."""
    compiled = {}
    for family, entries in FAMILIES.items():
        parts = []
        for aspect_id, (_, patterns) in entries.items():
            alternatives = "|".join(f"(?:{p})" for p in patterns)
            parts.append(f"(?P<{family}__{aspect_id}>\\b(?:{alternatives}))")
        compiled[family] = re.compile("|".join(parts), re.IGNORECASE)
    return compiled


def lexicon_aspects(text):
    """{(family, aspect_id)} mentioned in the text."""
    found = set()
    for family, pattern in lexicon_matcher().items():
        for match in pattern.finditer(text):
            family_name, aspect_id = match.lastgroup.split("__", 1)
            found.add((family_name, aspect_id))
    return found


def aspect_label(family, aspect_id):
    return FAMILIES[family][aspect_id][0]


# --------------------------------------------------------------------- datasets

_NAME = r"(?:[A-Z]|[a-z]{1,5}[A-Z])[A-Za-z0-9]*(?:[-_./][A-Za-z0-9]+)*(?:\s(?:[A-Z0-9][A-Za-z0-9]*(?:[-_.][A-Za-z0-9]+)*|v\d+))?"
DATASET_PATTERN = re.compile(
    rf"\b(?:on|using|with|of|from|in|over|across)\s+(?:the\s+)?(?:challenging\s+|public\s+|popular\s+|standard\s+)?"
    rf"((?:{_NAME})(?:\s*,\s*(?:and\s+)?(?:{_NAME}))*(?:\s*,?\s*and\s+(?:{_NAME}))?)"
    rf"\s+(?:datasets?|benchmarks?|corpus|corpora|challenge)\b")
DATASET_STOP = {
    "english", "chinese", "our", "this", "these", "that", "the", "real", "public", "large", "new", "two", "three",
    "four", "five", "several", "multiple", "various", "both", "all", "each", "other", "synthetic", "benchmark",
    "dataset", "standard", "popular", "existing", "different", "many", "most", "some", "such", "it", "we", "a",
    "an", "experiments", "extensive", "comprehensive", "challenging", "image", "text", "video", "medical",
    "real-world", "open", "in", "on", "and", "or", "with", "for", "multi", "one", "six", "seven", "eight",
}


def dataset_key(name):
    return re.sub(r"[\s\-_./]+", "", name).lower()


_TOKEN = re.compile(r"[A-Za-z0-9][A-Za-z0-9\-_./]*")


class DatasetLookup:
    """Finds known dataset names in a text by exact, case-sensitive matching of 1-3 consecutive tokens.

    Much faster than one regular expression with thousands of alternatives, and
    with the same word boundaries (a name never matches inside a longer token).
    """

    def __init__(self, surfaces):
        self.surfaces = set(surfaces)
        self.max_tokens = max((len(s.split()) for s in self.surfaces), default=1)

    def find(self, text):
        tokens = [t.rstrip("./") for t in _TOKEN.findall(text)]
        found = set()
        for i in range(len(tokens)):
            for size in range(1, self.max_tokens + 1):
                if i + size > len(tokens):
                    break
                candidate = " ".join(tokens[i:i + size])
                if candidate in self.surfaces:
                    found.add(candidate)
        return found


def dataset_names(text):
    """Dataset/benchmark names written before 'dataset(s)' or 'benchmark(s)' in the abstract."""
    names = set()
    for match in DATASET_PATTERN.finditer(text):
        for part in re.split(r"\s*,\s*(?:and\s+)?|\s+and\s+", match.group(1)):
            part = part.strip()
            if len(part) < 2 or part.lower() in DATASET_STOP or part.split()[0].lower() in DATASET_STOP:
                continue
            if not re.search(r"[A-Z0-9]", part[1:]) and len(part) < 4:
                continue
            names.add(part)
    return names


# --------------------------------------------------------------------- sentences and statements

ABBREVIATIONS = {"e.g", "i.e", "et al", "etc", "vs", "fig", "figs", "eq", "eqs", "sec", "no", "approx", "cf",
                 "resp", "al", "dr", "mr", "ms", "prof", "inc", "ltd", "st", "jr", "sr", "u.s", "e.g.,", "i.e.,"}
_BOUNDARY = re.compile(r"[.!?](?=\s+[A-Z0-9(\[\"'])")


def normalise_whitespace(text):
    return " ".join((text or "").split())


def split_sentences(abstract):
    """Sentences of a whitespace-normalised abstract, as (start, end) spans, never splitting after abbreviations."""
    text = normalise_whitespace(abstract)
    spans, start = [], 0
    for match in _BOUNDARY.finditer(text):
        end = match.end()
        word = text[start:end].rsplit(" ", 1)[-1].rstrip(".!?").lower()
        if word in ABBREVIATIONS or re.fullmatch(r"[a-z]", word) or re.fullmatch(r"[a-z](?:\.[a-z])+", word):
            continue
        spans.append((start, end))
        start = end + 1
    if start < len(text):
        spans.append((start, len(text)))
    return text, spans


FUTURE = re.compile(
    r"\b(?:future (?:work|research|directions?|studies|investigations?)|in the future|we plan to|"
    r"(?:is|are) left (?:for|as) future|remains? an open (?:problem|question|challenge)|"
    r"open (?:problems|questions|challenges|research questions)|further (?:research|work|investigation|studies) (?:is|are) (?:needed|required|warranted))\b",
    re.I)
UNDER_EXPLORED = re.compile(
    r"\b(?:(?:remains?|is|are|has been|have been)\s+(?:largely\s+|relatively\s+|still\s+|mostly\s+)?"
    r"(?:under-?explored|unexplored|overlooked|neglected|under-?studied|under-?investigated|under-?addressed)|"
    r"little (?:attention|work|research|effort)|(?:few|limited) (?:works|studies|research|attempts)|"
    r"(?:has|have) (?:not|rarely|seldom) been (?:studied|explored|investigated|addressed|considered)|"
    r"lack of (?:research|studies|work|systematic)|research gaps?|gaps? in (?:the )?(?:literature|research|current research))\b",
    re.I)
LIMITATION = re.compile(
    r"\b(?:limitations?|limited (?:to|by|in)|shortcomings?|drawbacks?|fail(?:s|ed)? to|struggle(?:s|d)? (?:to|with)|"
    r"(?:does|do|did) not (?:generali[sz]e|scale|account for|consider|handle|capture)|"
    r"cannot (?:handle|capture|generali[sz]e|scale|be applied)|suffer(?:s|ed)? from|bottlenecks?|"
    r"(?:remains?|is|are) (?:still )?(?:challenging|difficult|unsolved|an open challenge))\b",
    re.I)
PRIOR = re.compile(
    r"\b(?:existing|previous|prior|current|conventional|traditional|state-of-the-art|recent|most|many|earlier)\s+"
    r"(?:\w+\s+)?(?:methods|approaches|works|models|systems|techniques|studies|research|solutions|frameworks|benchmarks|datasets)\b|"
    r"\bunlike\s+(?:the\s+)?(?:existing|previous|prior|current|conventional|traditional|state-of-the-art|recent|most|many|earlier|other)\b",
    re.I)
# A limitation the sentence says is being resolved ("we propose X, which eliminates these drawbacks", "radar
# compensating for visual sensor limitations", "to address these limitations, we present ..."), in any verb form.
_PROBLEM = r"(?:the|this|these|that|those|such|its|their|many|several|some) (?:\w+ )?(?:problems?|issues?|limitations?|challenges?|drawbacks?|shortcomings?|gaps?)"
RESOLVES = re.compile(
    r"(?<!-)\b(?:address(?:es|ed|ing)?|overc(?:ome|omes|oming|ame)|eliminat(?:e|es|ed|ing)|compensat(?:e|es|ed|ing)|"
    r"mitigat(?:e|es|ed|ing)|alleviat(?:e|es|ed|ing)|resolv(?:e|es|ed|ing)|tackl(?:e|es|ed|ing)|"
    r"circumvent(?:s|ed|ing)?|remed(?:y|ies|ied|ying)|"
    r"(?:solv(?:e|es|ed|ing)|bridg(?:e|es|ed|ing)|fill(?:s|ed|ing)?|clos(?:e|es|ed|ing)|deal(?:s|t|ing)? with) " + _PROBLEM + r")\b",
    re.I)
# A research gap the sentence says this paper addresses ("we address this research gap", "addressing gaps in the
# current research landscape"); "a gap in research that addresses ..." and "methods aim to bridge the performance gap
# between ..." do not count.
RESOLVES_GAP = re.compile(
    r"(?<!-)\b(?:address(?:es|ed|ing)?|fill(?:s|ed|ing)?|bridg(?:e|es|ed|ing)|clos(?:e|es|ed|ing)|tackl(?:e|es|ed|ing)|"
    r"narrow(?:s|ed|ing)?)\s+(?:(?:this|the|these|such|that|an?|several|some|existing)\s+)?"
    r"(?:(?:important|significant|critical|key|crucial|identified|aforementioned|main|major|remaining)\s+)?"
    r"(?:(?:research|knowledge|literature)\s+)?gaps?\b(?!\s+between)", re.I)
# Survey remarks that research gaps exist without naming one ("we identify research gaps ... to inspire future
# research", "highlights current trends, challenges, and research gaps"); removed before the under-explored cue.
GENERIC_GAP = re.compile(
    r"\b(?:identif(?:y|ies|ied|ying)|highlight(?:s|ed|ing)?|delineat(?:e|es|ed|ing)|outlin(?:e|es|ed|ing)|"
    r"discuss(?:es|ed|ing)?|summari[sz](?:e|es|ed|ing)|points? out|uncover(?:s|ed|ing)?)\s+(?:[\w,-]+\s+){0,6}?"
    r"(?:research\s+)?gaps?\b(?!\s+(?:in|on|of|regarding|concerning)\s+(?!the\s+(?:literature|research|field)))", re.I)
# A claim that the paper's own approach succeeds where prior work fails ("our approach solves tasks ... that prior
# methods cannot handle"): the limitation belongs to the prior work the paper improves on.
CLAIM = re.compile(r"\bour (?:approach|method|model|framework|system|algorithm|technique|solution)\b[^;:]{0,80}?"
                   r"\b(?:solves?|handles?|outperforms?|surpass(?:es)?|achieves?|succeeds?|overcomes?)\b", re.I)
# ... unless the verb is negated or still to come: "existing methods fail to address occlusion" (prior work),
# "limitations of current VLMs that need to be addressed" (still open), "limitations of current models in
# addressing ambiguity" (what the evaluated systems cannot do; a sentence-initial "In addressing ..." still counts).
NEGATED = re.compile(r"(?:fail(?:s|ed)? to|cannot|can ?not|unable to|not|never|struggle(?:s|d)? to|hard to|difficult to|"
                     r"to be|yet to|need(?:s|ed)? to|should|must|\w\s+in)"
                     r"(?:\s+(?:be|fully|effectively|adequately|properly|explicitly|directly|further))*\s*$", re.I)
OWN = re.compile(r"\b(?:our (?:method|approach|model|system|framework|results?|analysis|study|work|evaluation)|"
                 r"the proposed|this (?:work|paper|study|approach|method)|we (?:acknowledge|note|discuss) (?:the |its |some )?limitations?)\b",
                 re.I)
# Findings about the systems a paper evaluated. A bare "reveal" is not enough ("data ... can reveal whether ...").
EVALUATED = re.compile(r"\b(?:we (?:find|found|show|observe|reveal|demonstrate)|(?:results|experiments?|analys[ie]s|evaluations?|"
                       r"stud(?:y|ies)|benchmark(?:ing)?|findings|investigations?|development|tests?|comparisons?|"
                       r"assessments?|audits?|ablations?)\b[^;:]{0,120}?\b(?:show|reveal|indicate|demonstrate|confirm)s?)\b",
                       re.I)
# Generic remarks about future work that state no specific open problem ("guidance for future research", "to aid
# future work on ...", "insights into ... future directions"); removed before the future-work cue is checked.
GENERIC_FUTURE = re.compile(
    r"\b(?:inspire[sd]?|aids?|guides?|guidance|benefits?|facilitates?|fosters?|stimulates?|motivates?|paves? the way for|"
    r"foundation for|basis for|resources? for|reference for|baselines? for|valuable for|useful for|insights? (?:into|for)|"
    r"directions for|lessons for|implications for)\s+(?:[\w-]+\s+){0,6}?future (?:work|research|studies|investigations?|directions?)\b",
    re.I)

STATEMENT_TYPES = {
    "future_work": "Future work stated by the authors",
    "under_explored": "Topic described as under-explored by the authors",
    "limitation_own": "Limitation of the paper's own approach",
    "limitation_evaluated": "Limitation found in the systems the paper evaluated",
    "limitation_prior": "Limitation of prior work (motivation)",
    "limitation_unclear": "Limitation (whose is unclear)",
    "limitation_addressed": "Limitation or gap the paper says it addresses",
}


def resolves(sentence, pattern=RESOLVES):
    """True when the sentence says a limitation (or, with RESOLVES_GAP, a research gap) is being addressed."""
    return any(not NEGATED.search(sentence[:m.start()]) for m in pattern.finditer(sentence))


def statement_type(sentence):
    """The candidate statement type of a sentence, or None. Rules are applied in this order."""
    if FUTURE.search(GENERIC_FUTURE.sub(" ", sentence)):  # "to aid future work" alone states no open problem
        return "future_work"
    if UNDER_EXPLORED.search(sentence) and resolves(sentence, RESOLVES_GAP):  # "we address this research gap"
        return "limitation_addressed"
    if UNDER_EXPLORED.search(GENERIC_GAP.sub(" ", sentence)):  # "we identify research gaps" alone names no gap
        return "under_explored"
    if not LIMITATION.search(sentence):
        return None
    if resolves(sentence):  # "we propose X, which eliminates these drawbacks": the paper's solution, not a gap
        return "limitation_addressed"
    if CLAIM.search(sentence) and PRIOR.search(sentence):  # "our approach solves ... that prior methods cannot handle"
        return "limitation_prior"
    if EVALUATED.search(sentence):  # "results show that current models still struggle ..."
        return "limitation_evaluated"
    if PRIOR.search(sentence):
        return "limitation_prior"
    if OWN.search(sentence):
        return "limitation_own"
    return "limitation_unclear"
