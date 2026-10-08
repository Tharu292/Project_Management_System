package com.researchpms.backend.c4.wellbeing.dto;

import java.time.Instant;
import java.util.UUID;

/** OWNER ONLY. */
public record MyWarningResponse(UUID id, String ruleCode, String message, Instant raisedAt, Instant readAt) {
}
