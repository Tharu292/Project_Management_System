package com.researchpms.backend.c4.contribution.dto;

import com.researchpms.backend.c4.contribution.EvidenceSource;
import com.researchpms.backend.c4.contribution.EvidenceType;
import com.researchpms.backend.c4.contribution.PullRequestState;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * One stored Contribution Indicator calculation, exactly as it was stored.
 * A snapshot is cumulative: it covers the project from {@code periodStart} to
 * {@code periodEnd}. A null score means no evidence was available for it.
 * {@code pullRequestStates} is null when pull-request evidence was unavailable.
 * It holds aggregate figures only: no itemised evidence, no wellbeing
 * information, and nothing that is a mark.
 */
public record SnapshotView(int schemaVersion, int scoringConfigVersion, LocalDate periodStart, LocalDate periodEnd,
		Instant computedAt, BigDecimal indicator, BigDecimal developmentScore, BigDecimal taskScore,
		BigDecimal collaborationScore, boolean partial, Map<EvidenceType, MetricView> metrics,
		Map<PullRequestState, Long> pullRequestStates, Map<EvidenceSource, SourceCoverageView> coverage,
		List<EvidenceSource> unavailableSources) {
}
