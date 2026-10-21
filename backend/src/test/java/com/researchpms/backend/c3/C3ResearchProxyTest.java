package com.researchpms.backend.c3;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Module 5: the backend forwards signed-in users' requests to the ML service and
 * translates its errors. A small local HTTP server stands in for FastAPI; its
 * answers have the same shape as the real service's (see ml-service/docs/api.md).
 */
class C3ResearchProxyTest extends C3TestSupport {

	private static final HttpServer ML = startFakeMlService();

	/** What the fake ML service answers next: status and JSON body. */
	private static final AtomicReference<Object[]> NEXT_ANSWER = new AtomicReference<>();

	private static final AtomicReference<String> LAST_REQUEST = new AtomicReference<>();

	@DynamicPropertySource
	static void mlServiceUrl(DynamicPropertyRegistry registry) {
		registry.add("app.c3.ml-service.url", () -> "http://127.0.0.1:" + ML.getAddress().getPort());
	}

	private static HttpServer startFakeMlService() {
		try {
			HttpServer server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
			server.createContext("/", C3ResearchProxyTest::answer);
			server.start();
			return server;
		}
		catch (IOException ex) {
			throw new IllegalStateException(ex);
		}
	}

	private static void answer(HttpExchange exchange) throws IOException {
		String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
		LAST_REQUEST.set(exchange.getRequestMethod() + " " + exchange.getRequestURI() + " " + body);
		Object[] next = NEXT_ANSWER.get();
		byte[] bytes = ((String) next[1]).getBytes(StandardCharsets.UTF_8);
		exchange.getResponseHeaders().add("Content-Type", "application/json");
		exchange.sendResponseHeaders((Integer) next[0], bytes.length);
		try (OutputStream out = exchange.getResponseBody()) {
			out.write(bytes);
		}
	}

	@AfterAll
	static void stopFakeMlService() {
		ML.stop(0);
	}

	@BeforeEach
	void defaultAnswer() {
		NEXT_ANSWER.set(new Object[] { 200, "{\"ok\": true}" });
		LAST_REQUEST.set(null);
	}

	private static final String PREDICTION = """
			{"category": "cs.RO", "categoryName": "Robotics", "modelVersion": "svm_tfidf_v1",
			 "ranking": [{"rank": 1, "category": "cs.RO", "categoryName": "Robotics", "decisionScore": 1.8}],
			 "scoreNote": "not probabilities", "recognisedTerms": 40, "limitations": ["five categories only"]}
			""";

	@Test
	void predictionIsForwardedAndAnsweredUnchanged() throws Exception {
		NEXT_ANSWER.set(new Object[] { 200, PREDICTION });
		postAs(student, "/api/v1/c3/research/predict", """
				{"title": "Legged robots", "abstract": "We study footstep planning.", "userId": "ignored"}
				""").andExpect(status().isOk())
			.andExpect(jsonPath("$.category").value("cs.RO"))
			.andExpect(jsonPath("$.ranking[0].decisionScore").value(1.8))
			.andExpect(jsonPath("$.limitations[0]").value("five categories only"));
		// Only title and abstract reach the ML service.
		assertThat(LAST_REQUEST.get()).startsWith("POST /api/v1/predict ")
			.contains("\"title\":\"Legged robots\"")
			.contains("\"abstract\":\"We study footstep planning.\"")
			.doesNotContain("userId");
	}

	@Test
	void mlValidationErrorsKeepTheirFieldsButUseThisApisPath() throws Exception {
		NEXT_ANSWER.set(new Object[] { 400, """
				{"status": 400, "message": "The request was not valid.", "path": "/api/v1/predict",
				 "fieldErrors": {"abstract": "The abstract must have at least 30 words (it has 2)."}}
				""" });
		postAs(student, "/api/v1/c3/research/predict", "{\"title\": \"t t t\", \"abstract\": \"too short\"}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fieldErrors.abstract").value("The abstract must have at least 30 words (it has 2)."))
			.andExpect(jsonPath("$.path").value("/api/v1/c3/research/predict"));
	}

	@Test
	void unavailableModelAndUnexpectedErrorsAreTranslated() throws Exception {
		NEXT_ANSWER.set(new Object[] { 503, "{\"message\": \"The topic classifier is not available.\"}" });
		postAs(student, "/api/v1/c3/research/predict", "{\"title\": \"t\", \"abstract\": \"a\"}")
			.andExpect(status().isServiceUnavailable())
			.andExpect(jsonPath("$.message").value("The topic classifier is not available."));
		NEXT_ANSWER.set(new Object[] { 500, "{\"message\": \"Traceback: secret internals\"}" });
		getAs(student, "/api/v1/c3/research/trends").andExpect(status().isBadGateway())
			.andExpect(content().string(not(containsString("Traceback"))));
	}

	@Test
	void queryParametersAreForwarded() throws Exception {
		getAs(supervisor, "/api/v1/c3/research/emerging-topics?category=cs.CL&limit=3").andExpect(status().isOk());
		assertThat(LAST_REQUEST.get()).startsWith("GET /api/v1/emerging-topics?category=cs.CL&limit=3 ");
		getAs(supervisor, "/api/v1/c3/research/trends").andExpect(status().isOk());
		assertThat(LAST_REQUEST.get()).startsWith("GET /api/v1/trends ");
		getAs(evaluator, "/api/v1/c3/research/model/metrics").andExpect(status().isOk());
		assertThat(LAST_REQUEST.get()).startsWith("GET /api/v1/model/metrics ");
		getAs(outsider, "/api/v1/c3/research/status").andExpect(status().isOk());
		assertThat(LAST_REQUEST.get()).startsWith("GET /health ");
	}

	@Test
	void opportunityAnalysisIsForwardedWithOnlyTitleAndAbstract() throws Exception {
		NEXT_ANSWER.set(new Object[] { 200, """
				{"basis": "not proof of a research gap", "directions": [{"rank": 1, "title": "a x b"}]}
				""" });
		postAs(student, "/api/v1/c3/research/opportunities", """
				{"title": "Legged robots", "abstract": "We study footstep planning.", "projectId": "ignored"}
				""").andExpect(status().isOk())
			.andExpect(jsonPath("$.directions[0].rank").value(1))
			.andExpect(jsonPath("$.basis").value("not proof of a research gap"));
		assertThat(LAST_REQUEST.get()).startsWith("POST /api/v1/opportunities ")
			.contains("\"title\":\"Legged robots\"")
			.doesNotContain("projectId");
		getAs(supervisor, "/api/v1/c3/research/opportunities/evaluation").andExpect(status().isOk());
		assertThat(LAST_REQUEST.get()).startsWith("GET /api/v1/opportunities/evaluation ");
	}

	@Test
	void gapAnalysisIsForwardedWithOnlyTitleAndAbstract() throws Exception {
		NEXT_ANSWER.set(new Object[] { 200, """
				{"evidenceLevel": "abstract", "inferredGaps": [], "directlySupportedGaps": []}
				""" });
		postAs(student, "/api/v1/c3/research/gap-analysis", """
				{"title": "Legged robots", "abstract": "We study footstep planning.", "userId": "ignored"}
				""").andExpect(status().isOk()).andExpect(jsonPath("$.evidenceLevel").value("abstract"));
		assertThat(LAST_REQUEST.get()).startsWith("POST /api/v1/gap-analysis ")
			.contains("\"abstract\":\"We study footstep planning.\"")
			.doesNotContain("userId");
		getAs(supervisor, "/api/v1/c3/research/gap-analysis/evaluation").andExpect(status().isOk());
		assertThat(LAST_REQUEST.get()).startsWith("GET /api/v1/gap-analysis/evaluation ");
	}

	@Test
	void gapAnalysisChecksFieldsAndRequiresSignIn() throws Exception {
		expectFieldError(postAs(student, "/api/v1/c3/research/gap-analysis", "{\"abstract\": \"a\"}"), "title");
		expectUnauthorized(postAs(null, "/api/v1/c3/research/gap-analysis", "{\"title\": \"t\", \"abstract\": \"a\"}"));
		expectUnauthorized(getAs(null, "/api/v1/c3/research/gap-analysis/evaluation"));
		assertThat(LAST_REQUEST.get()).isNull();
	}

	@Test
	void opportunityAnalysisChecksFieldsAndRequiresSignIn() throws Exception {
		expectFieldError(postAs(student, "/api/v1/c3/research/opportunities", "{\"title\": \"t\"}"), "abstract");
		expectUnauthorized(postAs(null, "/api/v1/c3/research/opportunities", "{\"title\": \"t\", \"abstract\": \"a\"}"));
		expectUnauthorized(getAs(null, "/api/v1/c3/research/opportunities/evaluation"));
		assertThat(LAST_REQUEST.get()).isNull();
	}

	@Test
	void requiresSignInAndNeverReachesTheMlServiceOtherwise() throws Exception {
		expectUnauthorized(postAs(null, "/api/v1/c3/research/predict", "{\"title\": \"t\", \"abstract\": \"a\"}"));
		expectUnauthorized(getAs(null, "/api/v1/c3/research/trends"));
		assertThat(LAST_REQUEST.get()).isNull();
	}

	@Test
	void missingFieldsAreRejectedBeforeCallingTheMlService() throws Exception {
		expectFieldError(postAs(student, "/api/v1/c3/research/predict", "{\"title\": \"t\"}"), "abstract");
		expectFieldError(postAs(student, "/api/v1/c3/research/predict", "{\"title\": \" \", \"abstract\": \"a\"}"), "title");
		assertThat(LAST_REQUEST.get()).isNull();
	}

}
