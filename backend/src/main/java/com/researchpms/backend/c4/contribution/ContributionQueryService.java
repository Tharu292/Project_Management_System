package com.researchpms.backend.c4.contribution;

import com.researchpms.backend.c4.contribution.dto.GroupContributionResponse;
import com.researchpms.backend.c4.contribution.dto.MemberContributionResponse;
import com.researchpms.backend.c4.contribution.dto.ScoringConfigView;
import com.researchpms.backend.c4.contribution.dto.SnapshotView;
import com.researchpms.backend.c4.contribution.dto.StudentContributionResponse;
import com.researchpms.backend.c4.integration.ProjectMembershipPort;
import com.researchpms.backend.c4.integration.ProjectMembershipPort.GroupStudent;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reads stored Contribution Indicators. It calculates nothing and creates
 * nothing: a student without a stored snapshot is reported as "not
 * calculated", never with a number. It knows nothing about wellbeing or marks.
 */
@Service
public class ContributionQueryService {

	private final ContributionAccessService contributionAccess;

	private final ContributionSnapshotRepository snapshotRepository;

	private final ScoringConfigRepository scoringConfigRepository;

	private final ProjectMembershipPort membership;

	private final SnapshotJsonReader snapshotReader;

	private final ScoringConfigReader scoringConfigReader;

	public ContributionQueryService(ContributionAccessService contributionAccess,
			ContributionSnapshotRepository snapshotRepository, ScoringConfigRepository scoringConfigRepository,
			ProjectMembershipPort membership, SnapshotJsonReader snapshotReader,
			ScoringConfigReader scoringConfigReader) {
		this.contributionAccess = contributionAccess;
		this.snapshotRepository = snapshotRepository;
		this.scoringConfigRepository = scoringConfigRepository;
		this.membership = membership;
		this.snapshotReader = snapshotReader;
		this.scoringConfigReader = scoringConfigReader;
	}

	/** The weights in use and the latest snapshot of every active student in the group. */
	@Transactional(readOnly = true)
	public GroupContributionResponse groupContribution(UUID projectId) {
		contributionAccess.requireGroupView(projectId);
		Map<UUID, ContributionSnapshot> latest = new LinkedHashMap<>();
		for (ContributionSnapshot snapshot : snapshotRepository
			.findByProjectIdOrderByPeriodEndDescComputedAtDesc(projectId)) {
			latest.putIfAbsent(snapshot.getStudentId(), snapshot);
		}
		List<MemberContributionResponse> members = membership.activeStudents(projectId).stream().map(student -> {
			ContributionSnapshot snapshot = latest.get(student.userId());
			return MemberContributionResponse.of(student.userId(), student.displayName(),
					snapshot == null ? null : snapshotReader.read(snapshot));
		}).toList();
		return new GroupContributionResponse(activeScoringConfig(), members);
	}

	/** One student's stored snapshots, newest first. */
	@Transactional(readOnly = true)
	public StudentContributionResponse studentContribution(UUID projectId, UUID studentId) {
		contributionAccess.requireStudentView(projectId, studentId);
		String displayName = membership.activeStudents(projectId)
			.stream()
			.filter(student -> student.userId().equals(studentId))
			.map(GroupStudent::displayName)
			.findFirst()
			.orElse("");
		List<SnapshotView> history = snapshotRepository
			.findByProjectIdAndStudentIdOrderByPeriodEndDescComputedAtDesc(projectId, studentId)
			.stream()
			.map(snapshotReader::read)
			.toList();
		return new StudentContributionResponse(activeScoringConfig(), studentId, displayName, !history.isEmpty(),
				history.isEmpty() ? null : history.get(0), history);
	}

	private ScoringConfigView activeScoringConfig() {
		ScoringConfig active = scoringConfigRepository.findByActiveTrue()
			.orElseThrow(() -> new ContributionDataFormatException("There is no active scoring configuration."));
		return scoringConfigReader.read(active);
	}

}
