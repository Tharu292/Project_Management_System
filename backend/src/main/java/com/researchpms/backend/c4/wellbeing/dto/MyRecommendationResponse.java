package com.researchpms.backend.c4.wellbeing.dto;

import java.util.UUID;

/** OWNER ONLY. */
public record MyRecommendationResponse(UUID id, int isoYear, int isoWeek, String ruleCode, String message) {
}
