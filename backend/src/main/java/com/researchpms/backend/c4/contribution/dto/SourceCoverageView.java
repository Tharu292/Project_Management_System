package com.researchpms.backend.c4.contribution.dto;

import com.researchpms.backend.c4.contribution.CoverageStatus;

/** Whether one evidence source was readable, and a short reason code when it was not. */
public record SourceCoverageView(CoverageStatus status, String reason) {
}
