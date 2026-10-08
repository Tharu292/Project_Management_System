package com.researchpms.backend.c4.progress;

import com.researchpms.backend.c4.integration.EvidenceResult;
import com.researchpms.backend.c4.integration.ProjectMembershipPort.GroupStudent;
import com.researchpms.backend.c4.integration.TaskEvidencePort.TaskRecord;
import com.researchpms.backend.c4.progress.TeamProgressResponse.MemberProgress;
import com.researchpms.backend.c4.progress.TeamProgressResponse.TaskCounts;
import java.util.List;

/**
 * Counts the tasks another component reports. It owns no task and decides
 * nothing about one: a task is "completed" when its owner says it has a
 * completion time.
 */
final class ProgressSummary {

	/** Used when the task component gives no reason of its own. */
	static final String TASKS_UNAVAILABLE = "TASKS_UNAVAILABLE";

	private ProgressSummary() {
	}

	static TeamProgressResponse summarise(EvidenceResult<TaskRecord> tasks, List<GroupStudent> students) {
		if (!tasks.available()) {
			String reason = tasks.unavailableReason();
			return TeamProgressResponse.unavailable(reason == null || reason.isBlank() ? TASKS_UNAVAILABLE : reason);
		}
		List<MemberProgress> members = students.stream().map(student -> {
			List<TaskRecord> own = tasks.items()
				.stream()
				.filter(task -> student.userId().equals(task.studentId()))
				.toList();
			long completed = own.stream().filter(task -> task.completedAt() != null).count();
			return new MemberProgress(student.userId(), student.displayName(), own.size(), completed);
		}).toList();
		// Tasks of people who are not active students of the group are left out of every figure.
		long assigned = members.stream().mapToLong(MemberProgress::assigned).sum();
		long completed = members.stream().mapToLong(MemberProgress::completed).sum();
		return new TeamProgressResponse(true, null, new TaskCounts(assigned, completed), members);
	}

}
