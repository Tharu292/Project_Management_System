package com.researchpms.backend.c4.contribution;

import com.researchpms.backend.c4.contribution.dto.ContributionSummaryResponse;
import com.researchpms.backend.c4.integration.ProjectMembershipPort;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reads stored Contribution Indicators. It calculates nothing, and it knows
 * nothing about wellbeing or marks.
 */
@Service
public class ContributionQueryService {

	private final ContributionAccessService contributionAccess;

	private final ContributionSnapshotRepository snapshotRepository;

	private final ProjectMembershipPort membership;

	public ContributionQueryService(ContributionAccessService contributionAccess,
			ContributionSnapshotRepository snapshotRepository, ProjectMembershipPort membership) {
		this.contributionAccess = contributionAccess;
		this.snapshotRepository = snapshotRepository;
		this.membership = membership;
	}

	/** The latest indicator of every active student in the group. */
	@Transactional(readOnly = true)
	public List<ContributionSummaryResponse> groupContribution(UUID projectId) {
		contributionAccess.requireGroupView(projectId);
		Map<UUID, ContributionSnapshot> latest = new LinkedHashMap<>();
		for (ContributionSnapshot snapshot : snapshotRepository
			.findByProjectIdOrderByPeriodEndDescComputedAtDesc(projectId)) {
			latest.putIfAbsent(snapshot.getStudentId(), snapshot);
		}
		return membership.activeStudentIds(projectId)
			.stream()
			.map(studentId -> latest.containsKey(studentId) ? ContributionSummaryResponse.from(latest.get(studentId))
					: ContributionSummaryResponse.notCalculated(studentId))
			.toList();
	}

	/** One student's indicators over time, newest first. */
	@Transactional(readOnly = true)
	public List<ContributionSummaryResponse> studentContribution(UUID projectId, UUID studentId) {
		contributionAccess.requireStudentView(projectId, studentId);
		return snapshotRepository.findByProjectIdAndStudentIdOrderByPeriodEndDescComputedAtDesc(projectId, studentId)
			.stream()
			.map(ContributionSummaryResponse::from)
			.toList();
	}

}
