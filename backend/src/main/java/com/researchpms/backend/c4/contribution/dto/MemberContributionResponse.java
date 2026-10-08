package com.researchpms.backend.c4.contribution.dto;

import java.util.UUID;

/**
 * One student of the group in the team comparison. The display name is the
 * only personal detail. {@code snapshot} is null, and {@code calculated}
 * false, when nothing has been calculated for the student yet.
 */
public record MemberContributionResponse(UUID studentId, String displayName, boolean calculated,
		SnapshotView snapshot) {

	public static MemberContributionResponse of(UUID studentId, String displayName, SnapshotView snapshot) {
		return new MemberContributionResponse(studentId, displayName, snapshot != null, snapshot);
	}

}
