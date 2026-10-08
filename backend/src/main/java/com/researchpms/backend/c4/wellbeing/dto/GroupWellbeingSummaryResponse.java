package com.researchpms.backend.c4.wellbeing.dto;

import com.researchpms.backend.c4.wellbeing.WellbeingStatus;
import com.researchpms.backend.c4.wellbeing.WellbeingTrend;
import java.math.BigDecimal;
import java.util.UUID;

/**
 * Everything a teammate may be shown about another student's wellbeing:
 * status, score and trend, and only when that student opted in. Nothing may
 * be added to this type: no dates, counts, emotions, text, recommendations or
 * warnings.
 *
 * <p>
 * When nothing is shown, the entry does not say why. A student who has not
 * opted in, one who withdrew, and one without enough history all look the same.
 */
public record GroupWellbeingSummaryResponse(UUID studentId, boolean available, WellbeingStatus status,
		BigDecimal score, WellbeingTrend trend) {

	public static GroupWellbeingSummaryResponse shared(UUID studentId, WellbeingStatus status, BigDecimal score,
			WellbeingTrend trend) {
		return new GroupWellbeingSummaryResponse(studentId, true, status, score, trend);
	}

	public static GroupWellbeingSummaryResponse notAvailable(UUID studentId) {
		return new GroupWellbeingSummaryResponse(studentId, false, null, null, null);
	}

}
