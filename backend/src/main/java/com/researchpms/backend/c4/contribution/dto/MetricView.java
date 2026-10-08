package com.researchpms.backend.c4.contribution.dto;

import com.researchpms.backend.c4.contribution.MetricState;
import java.math.BigDecimal;

/**
 * One metric of one snapshot. {@code count} and {@code normalised} are null
 * exactly when the state is UNAVAILABLE: an unavailable metric has no number,
 * and in particular it is not zero. {@code reason} is a short code saying why.
 */
public record MetricView(MetricState state, Long count, BigDecimal normalised, String reason) {
}
