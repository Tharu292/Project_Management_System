package com.researchpms.backend.c4.contribution.dto;

import java.util.List;

/** The team comparison: the weights in use and the latest snapshot of every active student. */
public record GroupContributionResponse(ScoringConfigView scoringConfig, List<MemberContributionResponse> members) {
}
