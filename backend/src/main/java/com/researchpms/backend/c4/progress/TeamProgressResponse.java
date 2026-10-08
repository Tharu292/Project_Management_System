package com.researchpms.backend.c4.progress;

import java.util.List;
import java.util.UUID;

/**
 * Task progress of a group, summarised from what the task management
 * component provides. When that component is not connected, or cannot answer,
 * {@code available} is false and there are no figures at all: missing task
 * data is never shown as "no tasks".
 */
public record TeamProgressResponse(boolean available, String unavailableReason, TaskCounts overall,
		List<MemberProgress> members) {

	public record TaskCounts(long assigned, long completed) {
	}

	public record MemberProgress(UUID studentId, String displayName, long assigned, long completed) {
	}

	public static TeamProgressResponse unavailable(String reason) {
		return new TeamProgressResponse(false, reason, null, List.of());
	}

}
