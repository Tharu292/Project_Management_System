package com.researchpms.backend.c4.integration;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Task evidence, owned and provided by the task management component.
 * Component 4 does not store or manage tasks. There is no implementation yet:
 * until that component supplies one, task evidence is unavailable.
 */
public interface TaskEvidencePort {

	/** The tasks assigned to the project's students that fall in the period. */
	EvidenceResult<TaskRecord> tasksFor(UUID projectId, LocalDate from, LocalDate to);

	/** Every kind of task counts the same: development, documentation, research, design or testing. */
	record TaskRecord(String externalId, UUID studentId, String taskType, Instant assignedAt, Instant dueAt,
			Instant completedAt, String sourceUrl) {
	}

}
