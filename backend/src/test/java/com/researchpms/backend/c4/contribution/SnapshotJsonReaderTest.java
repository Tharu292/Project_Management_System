package com.researchpms.backend.c4.contribution;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.researchpms.backend.c4.contribution.dto.SnapshotView;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Plain unit test: no Spring context and no database. Every snapshot here is made up for the test. */
class SnapshotJsonReaderTest {

	private static final String COMPLETE_METRICS = """
			{"schemaVersion": 1,
			 "metrics": {
			   "COMMIT": {"state": "VALUE", "count": 7, "normalised": 70.0},
			   "PULL_REQUEST": {"state": "VALUE", "count": 3, "normalised": 60.0},
			   "COMPLETED_TASK": {"state": "VALUE", "count": 4, "normalised": 80.0},
			   "ISSUE_COMMENT": {"state": "VERIFIED_ZERO", "count": 0, "normalised": 0},
			   "PULL_REQUEST_REVIEW": {"state": "VALUE", "count": 2, "normalised": 100}},
			 "pullRequestStates": {"MERGED": 2, "OPEN": 1, "CLOSED_UNMERGED": 0}}
			""";

	private static final String COMPLETE_COVERAGE = """
			{"schemaVersion": 1, "sources": {"GITHUB": {"status": "AVAILABLE"}, "TASKS": {"status": "AVAILABLE"}}}
			""";

	private static final String PARTIAL_METRICS = COMPLETE_METRICS.replace(
			"{\"state\": \"VALUE\", \"count\": 4, \"normalised\": 80.0}",
			"{\"state\": \"UNAVAILABLE\", \"reason\": \"TASKS_NOT_CONNECTED\"}");

	private static final String PARTIAL_COVERAGE = COMPLETE_COVERAGE.replace(
			"\"TASKS\": {\"status\": \"AVAILABLE\"}",
			"\"TASKS\": {\"status\": \"UNAVAILABLE\", \"reason\": \"TASKS_NOT_CONNECTED\"}");

	private final SnapshotJsonReader reader = new SnapshotJsonReader();

	private static ContributionSnapshot snapshot(String metrics, String coverage, boolean partial) {
		ScoringConfig config = new ScoringConfig(3, new BigDecimal("0.4"), new BigDecimal("0.4"), new BigDecimal("0.2"),
				"{}", null, null);
		return new ContributionSnapshot(UUID.randomUUID(), UUID.randomUUID(), LocalDate.of(2026, 9, 1),
				LocalDate.of(2026, 9, 30), config, metrics, new BigDecimal("70.00"), null, new BigDecimal("50.00"),
				new BigDecimal("63.33"), coverage, partial, Instant.parse("2026-10-01T08:00:00Z"));
	}

	private void assertRefused(String metrics, String coverage, boolean partial, String expectedMessagePart) {
		assertThatThrownBy(() -> reader.read(snapshot(metrics, coverage, partial)))
			.isInstanceOf(ContributionDataFormatException.class)
			.hasMessageContaining(expectedMessagePart);
	}

	// ---- what a valid snapshot yields ----

	@Test
	void aCompleteSnapshotIsReadAsStored() {
		SnapshotView view = reader.read(snapshot(COMPLETE_METRICS, COMPLETE_COVERAGE, false));

		assertThat(view.schemaVersion()).isEqualTo(1);
		assertThat(view.scoringConfigVersion()).isEqualTo(3);
		assertThat(view.periodStart()).isEqualTo(LocalDate.of(2026, 9, 1));
		assertThat(view.periodEnd()).isEqualTo(LocalDate.of(2026, 9, 30));
		assertThat(view.computedAt()).isEqualTo(Instant.parse("2026-10-01T08:00:00Z"));
		assertThat(view.indicator()).isEqualByComparingTo("63.33");
		assertThat(view.taskScore()).isNull();
		assertThat(view.partial()).isFalse();
		assertThat(view.unavailableSources()).isEmpty();
		assertThat(view.metrics()).containsOnlyKeys(EvidenceType.values());
		assertThat(view.metrics().get(EvidenceType.COMMIT).state()).isEqualTo(MetricState.VALUE);
		assertThat(view.metrics().get(EvidenceType.COMMIT).count()).isEqualTo(7);
		assertThat(view.metrics().get(EvidenceType.COMMIT).normalised()).isEqualByComparingTo("70");
		assertThat(view.pullRequestStates()).containsEntry(PullRequestState.MERGED, 2L)
			.containsEntry(PullRequestState.OPEN, 1L)
			.containsEntry(PullRequestState.CLOSED_UNMERGED, 0L);
		assertThat(view.coverage().get(EvidenceSource.GITHUB).status()).isEqualTo(CoverageStatus.AVAILABLE);
	}

	@Test
	void aVerifiedZeroIsZeroAndUnavailableEvidenceHasNoNumberAtAll() {
		SnapshotView view = reader.read(snapshot(PARTIAL_METRICS, PARTIAL_COVERAGE, true));

		var verifiedZero = view.metrics().get(EvidenceType.ISSUE_COMMENT);
		assertThat(verifiedZero.state()).isEqualTo(MetricState.VERIFIED_ZERO);
		assertThat(verifiedZero.count()).isZero();
		assertThat(verifiedZero.normalised()).isEqualByComparingTo("0");
		assertThat(verifiedZero.reason()).isNull();

		var unavailable = view.metrics().get(EvidenceType.COMPLETED_TASK);
		assertThat(unavailable.state()).isEqualTo(MetricState.UNAVAILABLE);
		assertThat(unavailable.count()).isNull();
		assertThat(unavailable.normalised()).isNull();
		assertThat(unavailable.reason()).isEqualTo("TASKS_NOT_CONNECTED");

		assertThat(view.partial()).isTrue();
		assertThat(view.unavailableSources()).containsExactly(EvidenceSource.TASKS);
		assertThat(view.coverage().get(EvidenceSource.TASKS).reason()).isEqualTo("TASKS_NOT_CONNECTED");
	}

	@Test
	void pullRequestStateCountsAreAbsentWhenPullRequestEvidenceIsUnavailable() {
		String metrics = """
				{"schemaVersion": 1,
				 "metrics": {
				   "COMMIT": {"state": "UNAVAILABLE", "reason": "GITHUB_UNREACHABLE"},
				   "PULL_REQUEST": {"state": "UNAVAILABLE", "reason": "GITHUB_UNREACHABLE"},
				   "COMPLETED_TASK": {"state": "VALUE", "count": 4, "normalised": 80.0},
				   "ISSUE_COMMENT": {"state": "UNAVAILABLE", "reason": "GITHUB_UNREACHABLE"},
				   "PULL_REQUEST_REVIEW": {"state": "UNAVAILABLE", "reason": "GITHUB_UNREACHABLE"}}}
				""";
		String coverage = """
				{"schemaVersion": 1, "sources": {"GITHUB": {"status": "UNAVAILABLE", "reason": "GITHUB_UNREACHABLE"},
												 "TASKS": {"status": "AVAILABLE"}}}
				""";

		SnapshotView view = reader.read(snapshot(metrics, coverage, true));

		assertThat(view.pullRequestStates()).isNull();
		assertThat(view.unavailableSources()).containsExactly(EvidenceSource.GITHUB);
	}

	@Test
	void propertiesALaterVersionMightAddAreIgnored() {
		String metrics = COMPLETE_METRICS.replace("\"schemaVersion\": 1,",
				"\"schemaVersion\": 1, \"addedLater\": {\"anything\": [1, 2, 3]},")
			.replace("\"count\": 7,", "\"count\": 7, \"alsoAddedLater\": \"x\",");
		String coverage = COMPLETE_COVERAGE.replace("\"schemaVersion\": 1,", "\"schemaVersion\": 1, \"extra\": true,");

		SnapshotView view = reader.read(snapshot(metrics, coverage, false));

		assertThat(view.metrics().get(EvidenceType.COMMIT).count()).isEqualTo(7);
	}

	// ---- versions ----

	@Test
	void aDocumentWithoutASchemaVersionIsRefused() {
		assertRefused(COMPLETE_METRICS.replace("\"schemaVersion\": 1,", ""), COMPLETE_COVERAGE, false,
				"no schema version");
		assertRefused(COMPLETE_METRICS, COMPLETE_COVERAGE.replace("\"schemaVersion\": 1,", ""), false,
				"no schema version");
	}

	@Test
	void anUnknownSchemaVersionIsRefusedNotGuessedAt() {
		for (String version : new String[] { "2", "0", "-1", "99" }) {
			assertRefused(COMPLETE_METRICS.replace("\"schemaVersion\": 1", "\"schemaVersion\": " + version),
					COMPLETE_COVERAGE, false, "cannot read");
		}
		assertRefused(COMPLETE_METRICS, COMPLETE_COVERAGE.replace("\"schemaVersion\": 1", "\"schemaVersion\": 2"),
				false, "cannot read");
	}

	// ---- malformed data ----

	@Test
	void textThatIsNotJsonOfTheExpectedShapeIsRefusedWithoutEchoingIt() {
		for (String malformed : new String[] { "not json", "{", "[]", "\"text\"", "{\"schemaVersion\": \"one\"}",
				"{\"schemaVersion\": 1, \"metrics\": \"SECRET-STORED-TEXT\"}" }) {
			assertThatThrownBy(() -> reader.read(snapshot(malformed, COMPLETE_COVERAGE, false)))
				.as(malformed)
				.isInstanceOf(ContributionDataFormatException.class)
				.hasMessageNotContaining("SECRET-STORED-TEXT");
		}
		assertRefused("", COMPLETE_COVERAGE, false, "is empty");
		assertRefused("null", COMPLETE_COVERAGE, false, "is empty");
		assertRefused(COMPLETE_METRICS, "   ", false, "is empty");
	}

	@Test
	void everyMetricMustBePresent() {
		assertRefused(COMPLETE_METRICS.replace("\"COMMIT\": {\"state\": \"VALUE\", \"count\": 7, \"normalised\": 70.0},",
				""), COMPLETE_COVERAGE, false, "metric COMMIT is missing");
		assertRefused("{\"schemaVersion\": 1}", COMPLETE_COVERAGE, false, "metrics are missing");
	}

	@Test
	void theStateMustBeKnownAndTheCountMustFitIt() {
		assertRefused(COMPLETE_METRICS.replace("\"state\": \"VERIFIED_ZERO\"", "\"state\": \"ZERO\""),
				COMPLETE_COVERAGE, false, "not a known value");
		// A "value" of zero and a "verified zero" of three both contradict themselves.
		assertRefused(COMPLETE_METRICS.replace("\"count\": 7", "\"count\": 0"), COMPLETE_COVERAGE, false,
				"does not fit the state");
		assertRefused(COMPLETE_METRICS.replace("\"state\": \"VERIFIED_ZERO\", \"count\": 0",
				"\"state\": \"VERIFIED_ZERO\", \"count\": 3"), COMPLETE_COVERAGE, false, "does not fit the state");
		assertRefused(COMPLETE_METRICS.replace("\"count\": 7", "\"count\": -7"), COMPLETE_COVERAGE, false,
				"does not fit the state");
		assertRefused(COMPLETE_METRICS.replace("\"count\": 7, ", ""), COMPLETE_COVERAGE, false, "are required");
	}

	@Test
	void unavailableEvidenceCanNeverCarryANumber() {
		assertRefused(PARTIAL_METRICS.replace("{\"state\": \"UNAVAILABLE\", \"reason\": \"TASKS_NOT_CONNECTED\"}",
				"{\"state\": \"UNAVAILABLE\", \"count\": 0}"), PARTIAL_COVERAGE, true, "cannot carry a number");
		assertRefused(PARTIAL_METRICS.replace("{\"state\": \"UNAVAILABLE\", \"reason\": \"TASKS_NOT_CONNECTED\"}",
				"{\"state\": \"UNAVAILABLE\", \"normalised\": 0}"), PARTIAL_COVERAGE, true, "cannot carry a number");
	}

	@Test
	void aNormalisedScoreMustBeBetweenZeroAndOneHundred() {
		assertRefused(COMPLETE_METRICS.replace("\"normalised\": 70.0", "\"normalised\": 100.01"), COMPLETE_COVERAGE,
				false, "outside 0 to 100");
		assertRefused(COMPLETE_METRICS.replace("\"normalised\": 70.0", "\"normalised\": -1"), COMPLETE_COVERAGE, false,
				"outside 0 to 100");
	}

	@Test
	void pullRequestStateCountsMustBePresentValidAndAddUpToThePullRequestCount() {
		assertRefused(COMPLETE_METRICS.replace(",\n \"pullRequestStates\": {\"MERGED\": 2, \"OPEN\": 1, \"CLOSED_UNMERGED\": 0}",
				""), COMPLETE_COVERAGE, false, "state counts are missing");
		assertRefused(COMPLETE_METRICS.replace("\"OPEN\": 1, ", ""), COMPLETE_COVERAGE, false, "no valid count");
		assertRefused(COMPLETE_METRICS.replace("\"OPEN\": 1", "\"OPEN\": -1"), COMPLETE_COVERAGE, false,
				"no valid count");
		// Five state counts for three pull requests would count some of them twice.
		assertRefused(COMPLETE_METRICS.replace("\"MERGED\": 2", "\"MERGED\": 4"), COMPLETE_COVERAGE, false,
				"do not add up");
	}

	@Test
	void coverageMustNameEverySourceWithAKnownStatus() {
		assertRefused(COMPLETE_METRICS, "{\"schemaVersion\": 1}", false, "coverage sources are missing");
		assertRefused(COMPLETE_METRICS,
				"{\"schemaVersion\": 1, \"sources\": {\"GITHUB\": {\"status\": \"AVAILABLE\"}}}", false,
				"coverage of TASKS is missing");
		assertRefused(COMPLETE_METRICS, COMPLETE_COVERAGE.replace("\"TASKS\": {\"status\": \"AVAILABLE\"}",
				"\"TASKS\": {\"status\": \"MAYBE\"}"), false, "not a known value");
	}

	@Test
	void aReasonMustBeAShortCodeNotFreeText() {
		assertRefused(PARTIAL_METRICS.replace("\"reason\": \"TASKS_NOT_CONNECTED\"}",
				"\"reason\": \"<script>alert(1)</script>\"}"), PARTIAL_COVERAGE, true, "not a valid code");
		assertRefused(PARTIAL_METRICS, PARTIAL_COVERAGE.replace("TASKS_NOT_CONNECTED", "the task tool was down"), true,
				"not a valid code");
	}

	@Test
	void aSnapshotWithUnavailableEvidenceMustBeMarkedPartial() {
		assertRefused(PARTIAL_METRICS, PARTIAL_COVERAGE, false, "not marked as partial");
		assertRefused(COMPLETE_METRICS, PARTIAL_COVERAGE, false, "not marked as partial");
	}

	@Test
	void metricsAndCoverageMustBeWrittenInTheSameVersion() {
		// Only version 1 exists, so a mismatch can only involve an unsupported version; both are refused.
		assertThatThrownBy(() -> reader.read(snapshot(COMPLETE_METRICS,
				COMPLETE_COVERAGE.replace("\"schemaVersion\": 1", "\"schemaVersion\": 3"), false)))
			.isInstanceOf(ContributionDataFormatException.class);
	}

}
