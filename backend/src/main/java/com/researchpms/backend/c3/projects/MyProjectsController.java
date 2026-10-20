package com.researchpms.backend.c3.projects;

import com.researchpms.backend.shared.project.Project;
import com.researchpms.backend.shared.project.ProjectMember;
import com.researchpms.backend.shared.project.ProjectMemberRepository;
import com.researchpms.backend.shared.project.ProjectRole;
import com.researchpms.backend.shared.project.ProjectStatus;
import com.researchpms.backend.shared.security.CurrentUserService;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The signed-in user's projects and their roles in each, for the project picker.
 * The user comes from the access token only; an administrator, who holds no
 * memberships, gets an empty list.
 */
@RestController
@RequestMapping("/api/v1/c3/me")
public class MyProjectsController {

	public record MyProjectResponse(UUID projectId, String projectCode, String title, ProjectStatus status,
			Set<ProjectRole> roles) {
	}

	private final ProjectMemberRepository memberRepository;

	private final CurrentUserService currentUserService;

	public MyProjectsController(ProjectMemberRepository memberRepository, CurrentUserService currentUserService) {
		this.memberRepository = memberRepository;
		this.currentUserService = currentUserService;
	}

	@GetMapping("/projects")
	@Transactional(readOnly = true)
	public List<MyProjectResponse> myProjects() {
		Map<UUID, Project> projects = new LinkedHashMap<>();
		Map<UUID, Set<ProjectRole>> roles = new LinkedHashMap<>();
		for (ProjectMember member : memberRepository.findByUserIdAndActiveTrue(currentUserService.getCurrentUserId())) {
			Project project = member.getProject();
			projects.putIfAbsent(project.getId(), project);
			roles.computeIfAbsent(project.getId(), id -> EnumSet.noneOf(ProjectRole.class)).add(member.getProjectRole());
		}
		List<MyProjectResponse> result = new ArrayList<>();
		projects.forEach((id, project) -> result.add(new MyProjectResponse(id, project.getProjectCode(),
				project.getTitle(), project.getStatus(), roles.get(id))));
		result.sort((a, b) -> a.title().compareToIgnoreCase(b.title()));
		return result;
	}

}
