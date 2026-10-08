package com.researchpms.backend.c4.integration;

import com.researchpms.backend.shared.project.Project;
import com.researchpms.backend.shared.project.ProjectMember;
import com.researchpms.backend.shared.project.ProjectMemberRepository;
import com.researchpms.backend.shared.project.ProjectRole;
import com.researchpms.backend.shared.user.AccountType;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Reads the shared project membership. It never writes to it. */
@Component
class SharedProjectMembershipAdapter implements ProjectMembershipPort {

	private final ProjectMemberRepository memberRepository;

	SharedProjectMembershipAdapter(ProjectMemberRepository memberRepository) {
		this.memberRepository = memberRepository;
	}

	@Override
	@Transactional(readOnly = true)
	public Set<ProjectRole> activeRoles(UUID userId, UUID projectId) {
		Set<ProjectRole> roles = EnumSet.noneOf(ProjectRole.class);
		for (ProjectMember member : memberRepository.findByUserIdAndProjectIdAndActiveTrue(userId, projectId)) {
			roles.add(member.getProjectRole());
		}
		return roles;
	}

	@Override
	@Transactional(readOnly = true)
	public boolean isActiveStudent(UUID userId, UUID projectId) {
		return memberRepository.findByUserIdAndProjectIdAndActiveTrue(userId, projectId)
			.stream()
			.anyMatch(SharedProjectMembershipAdapter::isStudent);
	}

	@Override
	@Transactional(readOnly = true)
	public List<UUID> activeStudentIds(UUID projectId) {
		return memberRepository.findByProjectIdAndProjectRoleAndActiveTrue(projectId, ProjectRole.STUDENT)
			.stream()
			.filter(SharedProjectMembershipAdapter::isStudent)
			.map(member -> member.getUser().getId())
			.sorted()
			.toList();
	}

	@Override
	@Transactional(readOnly = true)
	public List<GroupStudent> activeStudents(UUID projectId) {
		return memberRepository.findByProjectIdAndProjectRoleAndActiveTrue(projectId, ProjectRole.STUDENT)
			.stream()
			.filter(SharedProjectMembershipAdapter::isStudent)
			.map(member -> new GroupStudent(member.getUser().getId(),
					(member.getUser().getFirstName() + " " + member.getUser().getLastName()).trim()))
			.sorted(Comparator.comparing(GroupStudent::displayName).thenComparing(GroupStudent::userId))
			.toList();
	}

	@Override
	@Transactional(readOnly = true)
	public List<GroupMembership> activeMemberships(UUID userId) {
		Map<UUID, GroupMembership> byProject = new LinkedHashMap<>();
		for (ProjectMember member : memberRepository.findByUserIdAndActiveTrue(userId)) {
			Project project = member.getProject();
			byProject
				.computeIfAbsent(project.getId(),
						id -> new GroupMembership(id, project.getProjectCode(), project.getTitle(), project.getStatus(),
								EnumSet.noneOf(ProjectRole.class)))
				.roles()
				.add(member.getProjectRole());
		}
		return byProject.values().stream().sorted(Comparator.comparing(GroupMembership::projectCode)).toList();
	}

	private static boolean isStudent(ProjectMember member) {
		return member.getProjectRole() == ProjectRole.STUDENT
				&& member.getUser().getAccountType() == AccountType.STUDENT;
	}

}
