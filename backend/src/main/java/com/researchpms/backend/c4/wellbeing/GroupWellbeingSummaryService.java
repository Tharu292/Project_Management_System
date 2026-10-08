package com.researchpms.backend.c4.wellbeing;

import com.researchpms.backend.c4.integration.ProjectMembershipPort;
import com.researchpms.backend.c4.wellbeing.dto.GroupWellbeingSummaryResponse;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The group view of wellbeing. It reads two tables only, the sharing choices
 * and the rolling summaries, and never a reflection, a prediction, a weekly
 * value, a recommendation or a warning.
 */
@Service
public class GroupWellbeingSummaryService {

	private final WellbeingAccessService wellbeingAccess;

	private final ProjectMembershipPort membership;

	private final SharingPreferenceRepository sharingRepository;

	private final WellbeingSummaryRepository summaryRepository;

	GroupWellbeingSummaryService(WellbeingAccessService wellbeingAccess, ProjectMembershipPort membership,
			SharingPreferenceRepository sharingRepository, WellbeingSummaryRepository summaryRepository) {
		this.wellbeingAccess = wellbeingAccess;
		this.membership = membership;
		this.sharingRepository = sharingRepository;
		this.summaryRepository = summaryRepository;
	}

	/**
	 * One entry per active student of the group, in a stable order. An entry
	 * carries values only when that student opted in and has a summary; in
	 * every other case it is the same empty entry, so the reason cannot be told.
	 */
	@Transactional(readOnly = true)
	public List<GroupWellbeingSummaryResponse> groupSummary(UUID projectId) {
		wellbeingAccess.requireGroupSummaryView(projectId);
		Set<UUID> optedIn = sharingRepository.findByProjectIdAndSharedTrue(projectId)
			.stream()
			.map(SharingPreference::getStudentId)
			.collect(Collectors.toSet());
		Map<UUID, WellbeingSummary> summaries = summaryRepository.findByProjectId(projectId)
			.stream()
			.collect(Collectors.toMap(WellbeingSummary::getStudentId, Function.identity()));
		return membership.activeStudentIds(projectId).stream().map(studentId -> {
			WellbeingSummary summary = summaries.get(studentId);
			if (summary == null || !optedIn.contains(studentId)) {
				return GroupWellbeingSummaryResponse.notAvailable(studentId);
			}
			return GroupWellbeingSummaryResponse.shared(studentId, summary.getStatus(), summary.getScore(),
					summary.getTrend());
		}).toList();
	}

}
