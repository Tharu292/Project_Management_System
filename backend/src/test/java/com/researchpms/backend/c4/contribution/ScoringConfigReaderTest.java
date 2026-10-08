package com.researchpms.backend.c4.contribution;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.researchpms.backend.c4.contribution.dto.ScoringConfigView;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

/** Plain unit test: no Spring context and no database. */
class ScoringConfigReaderTest {

	private static final String WEIGHTS = """
			{"METRIC_WEIGHTS": {"COMMIT": 0.30, "PULL_REQUEST": 0.10, "COMPLETED_TASK": 0.40,
								"ISSUE_COMMENT": 0.10, "PULL_REQUEST_REVIEW": 0.10},
			 "PULL_REQUEST_STATE_MULTIPLIERS": {"MERGED": 1.0, "OPEN": 0.6, "CLOSED_UNMERGED": 0.3},
			 "PROVISIONAL": ["PULL_REQUEST_STATE_MULTIPLIERS"]}
			""";

	private final ScoringConfigReader reader = new ScoringConfigReader();

	private static ScoringConfig config(String development, String task, String collaboration, String weights) {
		return new ScoringConfig(7, new BigDecimal(development), new BigDecimal(task), new BigDecimal(collaboration),
				weights, null, null);
	}

	private void assertRefused(ScoringConfig config, String expectedMessagePart) {
		assertThatThrownBy(() -> reader.read(config)).isInstanceOf(ContributionDataFormatException.class)
			.hasMessageContaining(expectedMessagePart);
	}

	@Test
	void weightsAndMultipliersAreReadFromTheStoredConfiguration() {
		ScoringConfigView view = reader.read(config("0.4", "0.4", "0.2", WEIGHTS));

		assertThat(view.version()).isEqualTo(7);
		assertThat(view.categoryWeights().get(ContributionCategory.DEVELOPMENT)).isEqualByComparingTo("0.4");
		assertThat(view.categoryWeights().get(ContributionCategory.TASK_COMPLETION)).isEqualByComparingTo("0.4");
		assertThat(view.categoryWeights().get(ContributionCategory.COLLABORATION)).isEqualByComparingTo("0.2");
		assertThat(view.metricWeights().get(EvidenceType.COMMIT)).isEqualByComparingTo("0.30");
		assertThat(view.metricWeights().get(EvidenceType.PULL_REQUEST)).isEqualByComparingTo("0.10");
		assertThat(view.metricWeights().get(EvidenceType.COMPLETED_TASK)).isEqualByComparingTo("0.40");
		assertThat(view.metricWeights().get(EvidenceType.ISSUE_COMMENT)).isEqualByComparingTo("0.10");
		assertThat(view.metricWeights().get(EvidenceType.PULL_REQUEST_REVIEW)).isEqualByComparingTo("0.10");
		assertThat(view.pullRequestStateMultipliers().get(PullRequestState.MERGED)).isEqualByComparingTo("1.0");
		assertThat(view.pullRequestStateMultipliers().get(PullRequestState.OPEN)).isEqualByComparingTo("0.6");
		assertThat(view.pullRequestStateMultipliers().get(PullRequestState.CLOSED_UNMERGED)).isEqualByComparingTo("0.3");
		assertThat(view.provisional()).containsExactly("PULL_REQUEST_STATE_MULTIPLIERS");
	}

	@Test
	void aDifferentStoredVersionGivesDifferentWeights() {
		String other = WEIGHTS.replace("\"COMMIT\": 0.30, \"PULL_REQUEST\": 0.10", "\"COMMIT\": 0.20, \"PULL_REQUEST\": 0.20")
			.replace("\"OPEN\": 0.6", "\"OPEN\": 0.5")
			.replace("[\"PULL_REQUEST_STATE_MULTIPLIERS\"]", "[]");

		ScoringConfigView view = reader.read(config("0.4", "0.4", "0.2", other));

		assertThat(view.metricWeights().get(EvidenceType.COMMIT)).isEqualByComparingTo("0.20");
		assertThat(view.pullRequestStateMultipliers().get(PullRequestState.OPEN)).isEqualByComparingTo("0.5");
		assertThat(view.provisional()).isEmpty();
	}

	@Test
	void metricWeightsMustAddUpToTheirCategory() {
		assertRefused(config("0.5", "0.3", "0.2", WEIGHTS), "do not add up to its category weight");
		assertRefused(config("0.4", "0.4", "0.2", WEIGHTS.replace("\"COMMIT\": 0.30", "\"COMMIT\": 0.25")),
				"do not add up to its category weight");
	}

	@Test
	void everyMetricAndEveryPullRequestStateNeedsAValidValue() {
		assertRefused(config("0.4", "0.4", "0.2", WEIGHTS.replace("\"COMMIT\": 0.30, ", "")), "weight of COMMIT");
		assertRefused(config("0.4", "0.4", "0.2", WEIGHTS.replace("\"OPEN\": 0.6, ", "")), "multiplier of OPEN");
		assertRefused(config("0.4", "0.4", "0.2", WEIGHTS.replace("\"MERGED\": 1.0", "\"MERGED\": 1.5")),
				"outside 0 to 1");
		assertRefused(config("0.4", "0.4", "0.2", WEIGHTS.replace("\"OPEN\": 0.6", "\"OPEN\": -0.1")),
				"outside 0 to 1");
	}

	@Test
	void unknownMetricsStatesAndShapesAreRefused() {
		assertRefused(config("0.4", "0.4", "0.2", WEIGHTS.replace("\"COMMIT\": 0.30,", "\"COMMIT\": 0.30, \"LINES_OF_CODE\": 0.0,")),
				"unknown metric");
		assertRefused(config("0.4", "0.4", "0.2", WEIGHTS.replace("\"MERGED\": 1.0,", "\"MERGED\": 1.0, \"DRAFT\": 0.1,")),
				"unknown pull-request state");
		assertRefused(config("0.4", "0.4", "0.2", "{}"), "no metric weights");
		assertRefused(config("0.4", "0.4", "0.2", "not json"), "not valid JSON");
	}

}
