package com.researchpms.backend.c4.contribution;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.researchpms.backend.c4.contribution.dto.ScoringConfigView;
import java.math.BigDecimal;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/**
 * Turns a stored {@link ScoringConfig} into what is shown to users, checking
 * it on the way: there is exactly one weight per scored evidence type, the
 * metrics of each category add up to that category's weight, and there is one
 * multiplier per pull-request state. No weight is ever supplied by this code.
 */
@Component
public class ScoringConfigReader {

	private static final JsonMapper JSON = JsonMapper.builder().build();

	record WeightsDocument(@JsonProperty("METRIC_WEIGHTS") Map<String, BigDecimal> metricWeights,
			@JsonProperty("PULL_REQUEST_STATE_MULTIPLIERS") Map<String, BigDecimal> pullRequestStateMultipliers,
			@JsonProperty("PROVISIONAL") List<String> provisional) {
	}

	public ScoringConfigView read(ScoringConfig config) {
		String where = "Scoring configuration version " + config.getVersion();
		WeightsDocument document;
		try {
			document = JSON.readValue(config.getMetricWeights(), WeightsDocument.class);
		}
		catch (JacksonException ex) {
			throw new ContributionDataFormatException(where + " is not valid JSON of the expected shape.");
		}
		if (document == null || document.metricWeights() == null || document.pullRequestStateMultipliers() == null) {
			throw new ContributionDataFormatException(where + " has no metric weights or pull-request multipliers.");
		}

		Map<EvidenceType, BigDecimal> metricWeights = new EnumMap<>(EvidenceType.class);
		Map<ContributionCategory, BigDecimal> perCategory = new EnumMap<>(ContributionCategory.class);
		for (EvidenceType type : EvidenceType.values()) {
			BigDecimal weight = fraction(document.metricWeights().get(type.name()), where + ": weight of " + type);
			metricWeights.put(type, weight);
			perCategory.merge(type.getCategory(), weight, BigDecimal::add);
		}
		if (document.metricWeights().size() != EvidenceType.values().length) {
			throw new ContributionDataFormatException(where + " has a weight for an unknown metric.");
		}
		Map<ContributionCategory, BigDecimal> categoryWeights = new EnumMap<>(ContributionCategory.class);
		for (ContributionCategory category : ContributionCategory.values()) {
			BigDecimal categoryWeight = config.weightOf(category);
			if (perCategory.getOrDefault(category, BigDecimal.ZERO).compareTo(categoryWeight) != 0) {
				throw new ContributionDataFormatException(
						where + ": the metric weights of " + category + " do not add up to its category weight.");
			}
			categoryWeights.put(category, categoryWeight);
		}

		Map<PullRequestState, BigDecimal> multipliers = new EnumMap<>(PullRequestState.class);
		for (PullRequestState state : PullRequestState.values()) {
			multipliers.put(state,
					fraction(document.pullRequestStateMultipliers().get(state.name()), where + ": multiplier of " + state));
		}
		if (document.pullRequestStateMultipliers().size() != PullRequestState.values().length) {
			throw new ContributionDataFormatException(where + " has a multiplier for an unknown pull-request state.");
		}
		List<String> provisional = document.provisional() == null ? List.of() : List.copyOf(document.provisional());
		return new ScoringConfigView(config.getVersion(), categoryWeights, metricWeights, multipliers, provisional);
	}

	private static BigDecimal fraction(BigDecimal value, String where) {
		if (value == null || value.signum() < 0 || value.compareTo(BigDecimal.ONE) > 0) {
			throw new ContributionDataFormatException(where + " is missing or outside 0 to 1.");
		}
		return value;
	}

}
