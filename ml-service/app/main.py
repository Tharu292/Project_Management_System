"""Research PMS ML service (Component 3): topic classification and verified historical trends.

Meant to be called by the Spring Boot backend only, which handles sign-in; run it
on 127.0.0.1. Error responses have the same JSON shape as the backend's ApiError.
Submitted titles and abstracts are processed in memory and never stored or logged.
"""

import logging
from datetime import datetime, timezone
from http import HTTPStatus
from typing import Literal

from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, field_validator
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import Settings
from app.model_store import MIN_RECOGNISED_TERMS, ModelStore
from app.gap_store import GAP_BUILD_HINT, GapStore
from app.opportunity_store import BUILD_HINT, OpportunityStore
from app.reports_store import ReportsStore
from ml.categories import category_name

logger = logging.getLogger(__name__)

TITLE_MIN_CHARS, TITLE_MAX_CHARS = 3, 300
ABSTRACT_MIN_WORDS, ABSTRACT_MAX_WORDS, ABSTRACT_MAX_CHARS = 30, 1000, 10_000
SCORE_NOTE = (
    "Decision scores are the Linear SVM's raw margins. They only rank the categories for this text; "
    "they are not probabilities or confidence levels and must not be shown as percentages."
)


OPPORTUNITY_BASIS = (
    "Potential research directions derived from real arXiv papers: similar-paper retrieval (TF-IDF), an NMF "
    "topic model and topic-combination coverage over time. Low coverage in this corpus is not proof of a "
    "research gap, and no direction is claimed to be unexplored or novel."
)


class ApiProblem(Exception):
    def __init__(self, status, message, field_errors=None):
        super().__init__(message)
        self.status, self.message, self.field_errors = status, message, field_errors or {}


class PredictRequest(BaseModel):
    """A research paper's title and abstract."""

    model_config = ConfigDict(extra="ignore", json_schema_extra={"example": {
        "title": "Learning footstep planning for legged robots on rough terrain",
        "abstract": "Replace with a research abstract of at least 30 words ...",
    }})

    title: str
    abstract: str

    @field_validator("title")
    @classmethod
    def check_title(cls, value):
        value = " ".join(value.split())
        if len(value) < TITLE_MIN_CHARS:
            raise ValueError(f"Enter a title of at least {TITLE_MIN_CHARS} characters.")
        if len(value) > TITLE_MAX_CHARS:
            raise ValueError(f"The title must be at most {TITLE_MAX_CHARS} characters.")
        return value

    @field_validator("abstract")
    @classmethod
    def check_abstract(cls, value):
        value = value.strip()
        words = len(value.split())
        if words == 0:
            raise ValueError("Enter the abstract.")
        if len(value) > ABSTRACT_MAX_CHARS:
            raise ValueError(f"The abstract must be at most {ABSTRACT_MAX_CHARS:,} characters.")
        if words < ABSTRACT_MIN_WORDS:
            raise ValueError(f"The abstract must have at least {ABSTRACT_MIN_WORDS} words (it has {words}).")
        if words > ABSTRACT_MAX_WORDS:
            raise ValueError(f"The abstract must have at most {ABSTRACT_MAX_WORDS:,} words (it has {words:,}).")
        return value


def error_body(status, message, path, field_errors=None):
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "status": status,
        "error": HTTPStatus(status).phrase,
        "message": message,
        "path": path,
        "fieldErrors": field_errors or {},
    }


def validation_message(error):
    kind = error["type"]
    if kind == "missing":
        return "This field is required."
    if kind == "string_type":
        return "Must be text."
    if kind == "int_parsing":
        return "Must be a whole number."
    message = error.get("msg", "Invalid value.")
    return message.removeprefix("Value error, ")


def create_app(settings=None):
    settings = settings or Settings.from_env()
    model = ModelStore(settings.model_path, settings.model_info_path).load()
    reports = ReportsStore(settings.reports_dir).load()
    opportunity = OpportunityStore(settings.opportunity_dir)
    gap = GapStore(settings.gap_dir, opportunity)
    if model.error:
        logger.warning(model.error)

    app = FastAPI(
        title="Research PMS ML Service",
        description="Research topic classification (TF-IDF + Linear SVM) and verified historical arXiv trends "
                    "for Component 3. Called by the Spring Boot backend; not exposed to browsers directly.",
        version="1.0.0",
    )
    app.state.model, app.state.reports, app.state.opportunity = model, reports, opportunity
    app.state.gap = gap

    # ------------------------------------------------------------ errors

    @app.exception_handler(ApiProblem)
    async def handle_problem(request: Request, exc: ApiProblem):
        return JSONResponse(error_body(exc.status, exc.message, request.url.path, exc.field_errors), exc.status)

    @app.exception_handler(RequestValidationError)
    async def handle_validation(request: Request, exc: RequestValidationError):
        field_errors = {}
        for error in exc.errors():
            if error["type"] == "json_invalid":
                return JSONResponse(error_body(400, "The request body is not valid JSON.", request.url.path), 400)
            location = [str(part) for part in error["loc"] if part not in ("body", "query")]
            if not location:
                return JSONResponse(error_body(400, "A JSON body with 'title' and 'abstract' is required.",
                                               request.url.path), 400)
            field_errors.setdefault(location[0], validation_message(error))
        return JSONResponse(error_body(400, "The request was not valid.", request.url.path, field_errors), 400)

    @app.exception_handler(StarletteHTTPException)
    async def handle_http(request: Request, exc: StarletteHTTPException):
        message = {404: "Not found.", 405: "This method is not allowed here."}.get(exc.status_code, "Request failed.")
        return JSONResponse(error_body(exc.status_code, message, request.url.path), exc.status_code)

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, exc: Exception):
        logger.exception("Unexpected error on %s", request.url.path)
        return JSONResponse(error_body(500, "Something went wrong. Please try again.", request.url.path), 500)

    # ------------------------------------------------------------ helpers

    def require_model():
        if not model.loaded:
            raise ApiProblem(503, "The topic classifier is not available. " + (model.error or ""))

    def require_trends():
        if not reports.trends_loaded:
            raise ApiProblem(503, "The research trend results are not available.")

    def check_category(category):
        if category is not None and category not in reports.categories:
            raise ApiProblem(400, "The request was not valid.", {
                "category": f"Unknown category '{category}'. Use one of: {', '.join(reports.categories)}."})

    def model_matches_reports():
        if not (model.loaded and reports.metrics_loaded):
            return None
        report_info = reports.metrics["model_info"]
        return (model.info.get("run_name"), model.info.get("created_at")) == (
            report_info.get("run_name"), report_info.get("created_at"))

    def prediction_limitations():
        labels = model.labels
        items = [
            f"Chooses between {len(labels)} arXiv computer-science categories only ({', '.join(labels)}). It has "
            "no 'other' category, so it always returns one of them, even for unrelated text.",
            "It reproduces the authors' own choice of primary arXiv category. It does not assess quality, "
            "novelty or research gaps.",
            "The decision scores only rank the categories for this text. They are not probabilities or "
            "confidence levels.",
        ]
        headline = reports.headline()
        if headline:
            items.append(
                f"Evaluated on arXiv abstracts: macro-F1 {headline['random']:.4f} on a random test split and "
                f"{headline['temporal']:.4f} when tested on newer papers than it was trained on. It has not been "
                "evaluated on student project proposals.")
        return items

    # ------------------------------------------------------------ routes

    @app.get("/")
    def root():
        return {"message": "Research PMS ML Service is running"}

    @app.get("/health")
    def health():
        matches = model_matches_reports()
        return {
            "status": "healthy" if model.loaded and reports.trends_loaded and reports.metrics_loaded else "degraded",
            "modelLoaded": model.loaded,
            "modelVersion": model.version if model.loaded else None,
            "modelError": model.error,
            "evaluationReportsLoaded": reports.metrics_loaded,
            "trendsLoaded": reports.trends_loaded,
            "modelMatchesReports": matches,
            "opportunityAnalysisAvailable": opportunity.available,
            "opportunityAnalysisLoaded": opportunity.loaded,
            "gapAnalysisAvailable": gap.available,
            "gapAnalysisLoaded": gap.loaded,
        }

    @app.post("/api/v1/predict")
    def predict(request: PredictRequest):
        require_model()
        ranking, recognised = model.classify(request.title, request.abstract)
        if recognised < MIN_RECOGNISED_TERMS:
            raise ApiProblem(400, "The text could not be classified.", {
                "abstract": f"The text contains too few terms the model recognises ({recognised} found, at least "
                            f"{MIN_RECOGNISED_TERMS} needed). Enter an English research title and abstract."})
        best = ranking[0][0]
        return {
            "category": best,
            "categoryName": category_name(best),
            "modelVersion": model.version,
            "ranking": [{"rank": i, "category": c, "categoryName": category_name(c), "decisionScore": round(s, 4)}
                        for i, (c, s) in enumerate(ranking, start=1)],
            "scoreNote": SCORE_NOTE,
            "recognisedTerms": recognised,
            "limitations": prediction_limitations(),
        }

    @app.get("/api/v1/model/metrics")
    def model_metrics():
        if not reports.metrics_loaded:
            raise ApiProblem(503, "The model evaluation results are not available.")
        body = reports.model_metrics()
        body["modelLoaded"] = model.loaded
        body["modelMatchesReports"] = model_matches_reports()
        return body

    @app.get("/api/v1/trends")
    def trends(category: str | None = Query(default=None, description="An arXiv category code, e.g. cs.RO")):
        require_trends()
        check_category(category)
        return reports.trend_series(category)

    @app.get("/api/v1/emerging-topics")
    def emerging_topics(
        category: str | None = Query(default=None, description="An arXiv category code, e.g. cs.CL"),
        direction: Literal["rising", "falling"] = Query(default="rising"),
        limit: int = Query(default=10, ge=1, le=10, description="Keywords per category (1-10)"),
    ):
        require_trends()
        check_category(category)
        return reports.keywords(category, direction, limit)

    @app.post("/api/v1/opportunities")
    def opportunities(request: PredictRequest):
        engine = opportunity.engine()
        if engine is None:
            raise ApiProblem(503, "The research opportunity analysis is not available. "
                                  + (opportunity.error or BUILD_HINT))
        analysis = engine.analyse(request.title, request.abstract)
        if analysis["recognisedTerms"] < MIN_RECOGNISED_TERMS:
            raise ApiProblem(400, "The text could not be analysed.", {
                "abstract": f"The text contains too few terms the index recognises ({analysis['recognisedTerms']} "
                            f"found, at least {MIN_RECOGNISED_TERMS} needed). Enter an English research title and abstract."})
        classification = None
        if model.loaded:
            ranking, _ = model.classify(request.title, request.abstract)
            classification = {"category": ranking[0][0], "categoryName": category_name(ranking[0][0]),
                              "modelVersion": model.version,
                              "ranking": [{"rank": i, "category": c, "categoryName": category_name(c)}
                                          for i, (c, _) in enumerate(ranking, start=1)]}
        return {"basis": OPPORTUNITY_BASIS, "classification": classification, **analysis}

    @app.get("/api/v1/opportunities/evaluation")
    def opportunity_evaluation():
        if reports.opportunity is None:
            raise ApiProblem(503, "The research opportunity evaluation reports are not available.")
        return {"available": opportunity.available, **reports.opportunity_evaluation()}

    @app.post("/api/v1/gap-analysis")
    def gap_analysis(request: PredictRequest):
        analyser = gap.analyser()
        if analyser is None:
            raise ApiProblem(503, "The aspect-level gap analysis is not available. "
                                  + (gap.error or opportunity.error or GAP_BUILD_HINT))
        result = analyser.analyse(request.title, request.abstract)
        if result["recognisedTerms"] < MIN_RECOGNISED_TERMS:
            raise ApiProblem(400, "The text could not be analysed.", {
                "abstract": f"The text contains too few terms the index recognises ({result['recognisedTerms']} "
                            f"found, at least {MIN_RECOGNISED_TERMS} needed). Enter an English research title and abstract."})
        return result

    @app.get("/api/v1/gap-analysis/evaluation")
    def gap_evaluation():
        if reports.gap is None:
            raise ApiProblem(503, "The gap analysis reports are not available.")
        review = reports.gap["review"]
        return {
            "available": gap.available,
            "evidenceLevel": "abstract",
            "evidenceStore": reports.gap["evidence"],
            "manualReview": review or {"labelled": False, "status": "No manual labels yet: extraction precision, "
                                       "recall and gap-identification accuracy are NOT measured."},
        }

    return app


app = create_app()
