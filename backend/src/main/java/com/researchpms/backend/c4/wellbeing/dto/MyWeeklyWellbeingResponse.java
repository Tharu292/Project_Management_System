package com.researchpms.backend.c4.wellbeing.dto;

import java.math.BigDecimal;

/**
 * OWNER ONLY. One week of a student's own results: the predicted emotion, how
 * decisively the model chose it, and the 1-5 value it mapped to.
 */
public record MyWeeklyWellbeingResponse(int isoYear, int isoWeek, String predictedLabel, String labelScheme,
		BigDecimal decisionMargin, String modelVersion, BigDecimal score) {
}
