package com.researchpms.backend.c4.contribution.dto;

import java.util.List;
import java.util.UUID;

/**
 * One student's contribution over time. {@code history} holds every stored
 * snapshot, newest first, and {@code latest} is its first entry (null when
 * there is none). Nothing is interpolated: a trend exists only where
 * snapshots really were stored.
 */
public record StudentContributionResponse(ScoringConfigView scoringConfig, UUID studentId, String displayName,
		boolean calculated, SnapshotView latest, List<SnapshotView> history) {
}
