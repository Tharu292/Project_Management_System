# ML service API (Component 3)

FastAPI service for research topic classification and the verified historical
arXiv trends. **It is called by the Spring Boot backend only.** Spring Boot
handles sign-in, and the browser never calls this service directly:
- the service has no authentication of its own;
- it sends no CORS headers;
- it must listen on `127.0.0.1`.

## Run

```powershell
cd ml-service
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 127.0.0.1 --port 8000
# Interactive documentation: http://127.0.0.1:8000/docs
```

| Environment variable | Default | Meaning |
|---|---|---|
| `ML_MODEL_PATH` | `models/svm_tfidf_v1.joblib` | Trained pipeline (git-ignored; created by `python -m ml.train_classifier`) |
| `ML_MODEL_INFO_PATH` | `<model>_info.json` next to the model | Model metadata |
| `ML_REPORTS_DIR` | `reports/` | Verified Phase A/B results (committed) |

**When the model file is missing or broken, the service still starts:**
- `/health` reports `modelLoaded: false` and the reason;
- `/api/v1/predict` returns 503;
- the metrics and trend endpoints keep working, because they read only the
  committed reports.

## Endpoints

| Method and path | Purpose |
|---|---|
| `GET /health` | `status` (`healthy` / `degraded`), `modelLoaded`, `modelVersion`, `modelError`, `evaluationReportsLoaded`, `trendsLoaded`, `modelMatchesReports` |
| `POST /api/v1/predict` | Classify a title and abstract |
| `GET /api/v1/model/metrics` | Evaluation results (random and temporal splits, baselines, McNemar, per category) |
| `GET /api/v1/trends?category=` | Annual counts, share of CS papers, growth (historical) |
| `GET /api/v1/emerging-topics?category=&direction=rising\|falling&limit=1..10` | Historically rising (or falling) keywords with yearly counts |
| `POST /api/v1/opportunities` | Similar real papers, topic profile, topic-combination coverage and 3–5 ranked potential research directions for a title and abstract (see `docs/opportunities.md`) |
| `GET /api/v1/opportunities/evaluation` | Retrieval, topic-model and recommendation evaluation reports |
| `POST /api/v1/gap-analysis` | Aspect-level gap analysis (abstract-level evidence): potential research gaps (evidence-supported, connected to the text, with uncertainty labels and cautions), coverage context, and raw quoted author statements (see `docs/gap_analysis.md`) |
| `GET /api/v1/gap-analysis/evaluation` | Evidence-store statistics and the manual review status (metrics only once labels exist) |

### `POST /api/v1/predict`

Request:

```json
{ "title": "…", "abstract": "…" }
```

Rules:
- `title`: 3–300 characters, with whitespace collapsed.
- `abstract`: 30–1,000 words and at most 10,000 characters. The 30-word
  minimum is the same rule used to filter the training data.
- Fields other than `title` and `abstract` are ignored.

Response (abridged):

```json
{
  "category": "cs.RO",
  "categoryName": "Robotics",
  "modelVersion": "svm_tfidf_v1",
  "ranking": [{ "rank": 1, "category": "cs.RO", "categoryName": "Robotics", "decisionScore": 1.8152 }, "…"],
  "scoreNote": "Decision scores are the Linear SVM's raw margins …",
  "recognisedTerms": 46,
  "limitations": ["…"]
}
```

`decisionScore` is the SVM's uncalibrated margin. It only ranks the categories
for this text. It is **not** a probability or a confidence level and must not
be shown as a percentage.

The model has no "other" category. It always returns one of its five
categories, and the `limitations` in the response say so.

**Unsupported input:** text sharing fewer than 5 terms (words or word pairs)
with the model's vocabulary is rejected with 400. This only catches text the
model cannot read at all. It does **not** detect topics outside the five
categories.

The submitted text is processed in memory. It is never stored or logged.

### Trends and emerging topics

Both endpoints serve the committed, tested files in `reports/trends/` exactly
as they are. Nothing is recalculated.

Every response carries a `basis` text stating that the data is **historical**:
- it is not a forecast;
- it is not research-gap detection.

The newest year in the snapshot is incomplete and is flagged with
`incomplete: true`.

## Errors

Errors use the same JSON shape as the Spring Boot backend's `ApiError`:

```json
{ "timestamp": "…Z", "status": 400, "error": "Bad Request", "message": "The request was not valid.",
  "path": "/api/v1/predict", "fieldErrors": { "abstract": "The abstract must have at least 30 words (it has 2)." } }
```

| Status | When |
|---|---|
| 400 | Invalid or missing fields, invalid JSON, no body, unknown category, invalid `limit`/`direction`, text the model cannot read |
| 404 / 405 | Unknown path / wrong method |
| 503 | Model or reports not available |
| 500 | Unexpected error (generic message; details only in the server log) |

## Tests

```powershell
python -m pytest
```

| Test file | Tests | What it covers |
|---|---|---|
| `tests/test_api.py` | 30 | Model loading, prediction, invalid inputs, missing and corrupt model files, trends, emerging topics and error handling |
| `tests/test_generated_reports.py` | 20 | Consistency of the generated reports |
| `tests/test_pipeline_units.py` | 16 | Unit tests of the pipeline helpers |
| `tests/test_opportunity.py` | 15 | Research opportunity engine, API and evaluation reports (index-dependent tests skip when `models/opportunity` is not built) |
| `tests/test_gap.py` | 22 | Gap-analysis rules, exact quotes, analyser consistency, API and review metrics (store-dependent tests skip when `models/gap` is not built) |

Tests that need the trained model are skipped, with a reason, when `models/`
has not been generated.
