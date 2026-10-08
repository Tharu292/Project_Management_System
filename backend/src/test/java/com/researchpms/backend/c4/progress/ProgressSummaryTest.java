package com.researchpms.backend.c4.progress;

import static org.assertj.core.api.Assertions.assertThat;

import com.researchpms.backend.c4.integration.EvidenceResult;
import com.researchpms.backend.c4.integration.ProjectMembershipPort.GroupStudent;
import com.researchpms.backend.c4.integration.TaskEvidencePort.TaskRecord;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Plain unit test: no Spring context and no database. The tasks here stand in
 * for what the task management component would report; they are test data only.
 */
class ProgressSummaryTest {

	private final GroupStudent first = new GroupStudent(UUID.randomUUID(), "Test Student One");

	private final GroupStudent second = new GroupStudent(UUID.randomUUID(), "Test Student Two");

	private static TaskRecord task(UUID studentId, boolean completed) {
		return new TaskRecord(UUID.randomUUID().toString(), studentId, "DOCUMENTATION", Instant.now(), null,
				completed ? Instant.now() : null, null);
	}

	@Test
	void unavailableTaskDataGivesNoFiguresAtAll() {
		TeamProgressResponse response = ProgressSummary
			.summarise(EvidenceResult.unavailable("TASK_SERVICE_DOWN"), List.of(first, second));

		assertThat(response.available()).isFalse();
		assertThat(response.unavailableReason()).isEqualTo("TASK_SERVICE_DOWN");
		assertThat(response.overall()).isNull();
		assertThat(response.members()).isEmpty();
	}

	@Test
	void anUnavailableResultWithoutAReasonStillSaysWhy() {
		assertThat(ProgressSummary.summarise(EvidenceResult.unavailable(null), List.of(first)).unavailableReason())
			.isEqualTo(ProgressSummary.TASKS_UNAVAILABLE);
	}

	@Test
	void availableTaskDataIsCountedPerStudent() {
		TeamProgressResponse response = ProgressSummary.summarise(EvidenceResult.of(List.of(task(first.userId(), true),
				task(first.userId(), true), task(first.userId(), false), task(second.userId(), false))),
				List.of(first, second));

		assertThat(response.available()).isTrue();
		assertThat(response.unavailableReason()).isNull();
		assertThat(response.overall().assigned()).isEqualTo(4);
		assertThat(response.overall().completed()).isEqualTo(2);
		assertThat(response.members()).extracting("displayName", "assigned", "completed")
			.containsExactly(org.assertj.core.groups.Tuple.tuple("Test Student One", 3L, 2L),
					org.assertj.core.groups.Tuple.tuple("Test Student Two", 1L, 0L));
	}

	@Test
	void availableDataWithNoTasksIsAVerifiedZeroNotUnavailable() {
		TeamProgressResponse response = ProgressSummary.summarise(EvidenceResult.of(List.of()), List.of(first));

		assertThat(response.available()).isTrue();
		assertThat(response.overall().assigned()).isZero();
		assertThat(response.members()).singleElement().extracting("assigned").isEqualTo(0L);
	}

	@Test
	void tasksOfPeopleOutsideTheGroupAreNotCounted() {
		TeamProgressResponse response = ProgressSummary.summarise(
				EvidenceResult.of(List.of(task(first.userId(), true), task(UUID.randomUUID(), true), task(null, true))),
				List.of(first));

		assertThat(response.overall().assigned()).isEqualTo(1);
		assertThat(response.members()).hasSize(1);
	}

}
