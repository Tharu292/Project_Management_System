package com.researchpms.backend.c4.contribution;

import com.researchpms.backend.c4.contribution.dto.GroupContributionResponse;
import com.researchpms.backend.c4.contribution.dto.StudentContributionResponse;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read-only contribution views for the students of a group and the staff
 * assigned to it. Who may see what is decided in the service. Nothing here
 * calculates, changes or creates anything.
 */
@RestController
@RequestMapping("/api/v1/c4/projects/{projectId}")
public class ContributionController {

	private final ContributionQueryService contribution;

	public ContributionController(ContributionQueryService contribution) {
		this.contribution = contribution;
	}

	@GetMapping("/contribution")
	public GroupContributionResponse groupContribution(@PathVariable UUID projectId) {
		return contribution.groupContribution(projectId);
	}

	@GetMapping("/students/{studentId}/contribution")
	public StudentContributionResponse studentContribution(@PathVariable UUID projectId, @PathVariable UUID studentId) {
		return contribution.studentContribution(projectId, studentId);
	}

}
