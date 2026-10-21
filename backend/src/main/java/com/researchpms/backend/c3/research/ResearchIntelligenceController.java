package com.researchpms.backend.c3.research;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.researchpms.backend.shared.common.ApiError;
import com.researchpms.backend.shared.common.InvalidRequestException;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Module 5, research intelligence: the signed-in user's gateway to the ML
 * service. Sign-in is enforced by the shared security configuration, like every
 * other endpoint; the ML service itself is never exposed to the browser. The
 * data is not project-specific, so no project role is needed.
 *
 * <p>
 * Answers are passed through unchanged, including their stated limitations:
 * the classifier's decision scores are not probabilities, and the trends are
 * historical, not forecasts or research-gap detection.
 */
@RestController
@RequestMapping("/api/v1/c3/research")
public class ResearchIntelligenceController {

	/** Only these two fields are forwarded. The ML service applies the detailed rules. */
	public record PredictionRequest(String title, @JsonProperty("abstract") String abstractText) {
	}

	private final MlServiceClient ml;

	public ResearchIntelligenceController(MlServiceClient ml) {
		this.ml = ml;
	}

	@GetMapping(value = "/status", produces = MediaType.APPLICATION_JSON_VALUE)
	public String status() {
		return ml.get("/health", Map.of());
	}

	@PostMapping(value = "/predict", produces = MediaType.APPLICATION_JSON_VALUE)
	public String predict(@RequestBody PredictionRequest request) {
		// Checked here only so that obviously bad requests never reach the ML service;
		// field names match the JSON (and the ML service's own errors).
		requireText("title", request.title(), "Enter a title.", 1000);
		requireText("abstract", request.abstractText(), "Enter the abstract.", 20000);
		Map<String, String> body = new LinkedHashMap<>();
		body.put("title", request.title());
		body.put("abstract", request.abstractText());
		return ml.postJson("/api/v1/predict", body);
	}

	/**
	 * Potential research directions for a title and abstract, grounded in real arXiv papers (retrieval, topic
	 * model, coverage). The answer states that low coverage is not proof of a research gap.
	 */
	@PostMapping(value = "/opportunities", produces = MediaType.APPLICATION_JSON_VALUE)
	public String opportunities(@RequestBody PredictionRequest request) {
		requireText("title", request.title(), "Enter a title.", 1000);
		requireText("abstract", request.abstractText(), "Enter the abstract.", 20000);
		Map<String, String> body = new LinkedHashMap<>();
		body.put("title", request.title());
		body.put("abstract", request.abstractText());
		return ml.postJson("/api/v1/opportunities", body);
	}

	@GetMapping(value = "/opportunities/evaluation", produces = MediaType.APPLICATION_JSON_VALUE)
	public String opportunityEvaluation() {
		return ml.get("/api/v1/opportunities/evaluation", Map.of());
	}

	/**
	 * Aspect-level gap analysis for a title and abstract: aspect coverage across the most similar papers, author
	 * statements quoted from their abstracts, and statistically inferred potential gaps, kept apart. Abstract-level
	 * evidence only.
	 */
	@PostMapping(value = "/gap-analysis", produces = MediaType.APPLICATION_JSON_VALUE)
	public String gapAnalysis(@RequestBody PredictionRequest request) {
		requireText("title", request.title(), "Enter a title.", 1000);
		requireText("abstract", request.abstractText(), "Enter the abstract.", 20000);
		Map<String, String> body = new LinkedHashMap<>();
		body.put("title", request.title());
		body.put("abstract", request.abstractText());
		return ml.postJson("/api/v1/gap-analysis", body);
	}

	@GetMapping(value = "/gap-analysis/evaluation", produces = MediaType.APPLICATION_JSON_VALUE)
	public String gapEvaluation() {
		return ml.get("/api/v1/gap-analysis/evaluation", Map.of());
	}

	@GetMapping(value = "/model/metrics", produces = MediaType.APPLICATION_JSON_VALUE)
	public String modelMetrics() {
		return ml.get("/api/v1/model/metrics", Map.of());
	}

	@GetMapping(value = "/trends", produces = MediaType.APPLICATION_JSON_VALUE)
	public String trends(@RequestParam(required = false) String category) {
		Map<String, String> query = new LinkedHashMap<>();
		query.put("category", category);
		return ml.get("/api/v1/trends", query);
	}

	@GetMapping(value = "/emerging-topics", produces = MediaType.APPLICATION_JSON_VALUE)
	public String emergingTopics(@RequestParam(required = false) String category,
			@RequestParam(required = false) String direction, @RequestParam(required = false) String limit) {
		Map<String, String> query = new LinkedHashMap<>();
		query.put("category", category);
		query.put("direction", direction);
		query.put("limit", limit);
		return ml.get("/api/v1/emerging-topics", query);
	}

	private static void requireText(String field, String value, String missing, int maxLength) {
		if (value == null || value.isBlank()) {
			throw new InvalidRequestException(field, missing);
		}
		if (value.length() > maxLength) {
			throw new InvalidRequestException(field, "At most %,d characters.".formatted(maxLength));
		}
	}

	@ExceptionHandler(MlServiceException.class)
	ResponseEntity<ApiError> handleMlService(MlServiceException ex, HttpServletRequest request) {
		ApiError body = new ApiError(Instant.now(), ex.getStatus().value(), ex.getStatus().getReasonPhrase(),
				ex.getMessage(), request.getRequestURI(), ex.getFieldErrors());
		return ResponseEntity.status(ex.getStatus()).contentType(MediaType.APPLICATION_JSON).body(body);
	}

}
