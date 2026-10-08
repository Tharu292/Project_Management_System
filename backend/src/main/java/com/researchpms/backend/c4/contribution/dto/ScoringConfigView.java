package com.researchpms.backend.c4.contribution.dto;

import com.researchpms.backend.c4.contribution.ContributionCategory;
import com.researchpms.backend.c4.contribution.EvidenceType;
import com.researchpms.backend.c4.contribution.PullRequestState;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * The weights in use, read from the stored configuration. Metric weights are
 * shares of the whole indicator. {@code provisional} names the parts that are
 * research assumptions still to be validated.
 */
public record ScoringConfigView(int version, Map<ContributionCategory, BigDecimal> categoryWeights,
		Map<EvidenceType, BigDecimal> metricWeights, Map<PullRequestState, BigDecimal> pullRequestStateMultipliers,
		List<String> provisional) {
}
