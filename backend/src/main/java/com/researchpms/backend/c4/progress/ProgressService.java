package com.researchpms.backend.c4.progress;

import com.researchpms.backend.c4.contribution.ContributionAccessService;
import com.researchpms.backend.c4.integration.ProjectMembershipPort;
import com.researchpms.backend.c4.integration.TaskEvidencePort;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

/**
 * Team progress, for the same people who may see the group's contribution.
 * The tasks themselves belong to the task management component and are only
 * read through {@link TaskEvidencePort}. Until that component provides an
 * implementation, progress is reported as unavailable.
 */
@Service
public class ProgressService {

	/** No task management component is connected to this application. */
	public static final String TASKS_NOT_CONNECTED = "TASKS_NOT_CONNECTED";

	private static final LocalDate PROJECT_START_UNKNOWN = LocalDate.of(2000, 1, 1);

	private final ContributionAccessService contributionAccess;

	private final ProjectMembershipPort membership;

	private final ObjectProvider<TaskEvidencePort> taskEvidence;

	public ProgressService(ContributionAccessService contributionAccess, ProjectMembershipPort membership,
			ObjectProvider<TaskEvidencePort> taskEvidence) {
		this.contributionAccess = contributionAccess;
		this.membership = membership;
		this.taskEvidence = taskEvidence;
	}

	public TeamProgressResponse teamProgress(UUID projectId) {
		contributionAccess.requireGroupView(projectId);
		TaskEvidencePort tasks = taskEvidence.getIfAvailable();
		if (tasks == null) {
			return TeamProgressResponse.unavailable(TASKS_NOT_CONNECTED);
		}
		return ProgressSummary.summarise(tasks.tasksFor(projectId, PROJECT_START_UNKNOWN, LocalDate.now()),
				membership.activeStudents(projectId));
	}

}
