package com.researchpms.backend.shared.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.researchpms.backend.shared.SharedTestData;
import com.researchpms.backend.shared.security.AuthenticatedUser;
import com.researchpms.backend.shared.user.SystemRole;
import com.researchpms.backend.shared.user.User;
import com.researchpms.backend.shared.user.UserRepository;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class ProjectAccessServiceTest {

	@Autowired
	private ProjectAccessService projectAccess;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ProjectRepository projectRepository;

	@Autowired
	private ProjectMemberRepository memberRepository;

	private User student;

	private User lecturer;

	private User outsider;

	private Project project;

	private Project otherProject;

	@BeforeEach
	void setUp() {
		student = userRepository.saveAndFlush(SharedTestData.student());
		lecturer = userRepository.saveAndFlush(SharedTestData.staff());
		outsider = userRepository.saveAndFlush(SharedTestData.student());
		project = projectRepository.saveAndFlush(SharedTestData.project());
		otherProject = projectRepository.saveAndFlush(SharedTestData.project());
		memberRepository.saveAndFlush(new ProjectMember(student, project, ProjectRole.STUDENT));
		memberRepository.saveAndFlush(new ProjectMember(lecturer, project, ProjectRole.SUPERVISOR));
		memberRepository.saveAndFlush(new ProjectMember(lecturer, project, ProjectRole.EVALUATOR));
		memberRepository.saveAndFlush(new ProjectMember(lecturer, otherProject, ProjectRole.CO_SUPERVISOR));
	}

	@AfterEach
	void signOut() {
		SecurityContextHolder.clearContext();
	}

	private static void signInAs(User user) {
		AuthenticatedUser principal = AuthenticatedUser.from(user);
		SecurityContextHolder.getContext()
			.setAuthentication(
					UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities()));
	}

	@Test
	void rolesAreReportedPerUserAndProject() {
		assertThat(projectAccess.getRoles(student.getId(), project.getId())).containsExactly(ProjectRole.STUDENT);
		assertThat(projectAccess.getRoles(lecturer.getId(), project.getId()))
			.containsExactlyInAnyOrder(ProjectRole.SUPERVISOR, ProjectRole.EVALUATOR);
		assertThat(projectAccess.getRoles(lecturer.getId(), otherProject.getId()))
			.containsExactly(ProjectRole.CO_SUPERVISOR);
		assertThat(projectAccess.getRoles(outsider.getId(), project.getId())).isEmpty();

		assertThat(projectAccess.isMember(student.getId(), project.getId())).isTrue();
		assertThat(projectAccess.isMember(student.getId(), otherProject.getId())).isFalse();
		assertThat(projectAccess.hasRole(lecturer.getId(), project.getId(), ProjectRole.EVALUATOR)).isTrue();
		assertThat(projectAccess.hasRole(lecturer.getId(), otherProject.getId(), ProjectRole.EVALUATOR)).isFalse();
	}

	@Test
	void memberPassesChecksForRolesTheyHold() {
		signInAs(student);

		assertThat(projectAccess.isCurrentUserMember(project.getId())).isTrue();
		assertThat(projectAccess.currentUserHasRole(project.getId(), ProjectRole.STUDENT)).isTrue();
		assertThat(projectAccess.getCurrentUserRoles(project.getId())).containsExactly(ProjectRole.STUDENT);
		assertThatCode(() -> projectAccess.requireMember(project.getId())).doesNotThrowAnyException();
		assertThatCode(() -> projectAccess.requireRole(project.getId(), ProjectRole.STUDENT)).doesNotThrowAnyException();
		assertThatCode(() -> projectAccess.requireAnyRole(project.getId(), ProjectRole.SUPERVISOR, ProjectRole.STUDENT))
			.doesNotThrowAnyException();
	}

	@Test
	void memberIsDeniedRolesTheyDoNotHold() {
		signInAs(student);

		assertThat(projectAccess.currentUserHasRole(project.getId(), ProjectRole.SUPERVISOR)).isFalse();
		assertThat(projectAccess.currentUserHasAnyRole(project.getId(), ProjectRole.SUPERVISOR, ProjectRole.EVALUATOR))
			.isFalse();
		assertThatThrownBy(() -> projectAccess.requireRole(project.getId(), ProjectRole.SUPERVISOR))
			.isInstanceOf(AccessDeniedException.class);
		assertThatThrownBy(
				() -> projectAccess.requireAnyRole(project.getId(), ProjectRole.SUPERVISOR, ProjectRole.EVALUATOR))
			.isInstanceOf(AccessDeniedException.class);
		assertThatThrownBy(() -> projectAccess.requireAnyRole(project.getId())).isInstanceOf(AccessDeniedException.class);
	}

	@Test
	void userWithSeveralRolesPassesEachOfThem() {
		signInAs(lecturer);

		assertThatCode(() -> projectAccess.requireRole(project.getId(), ProjectRole.SUPERVISOR))
			.doesNotThrowAnyException();
		assertThatCode(() -> projectAccess.requireRole(project.getId(), ProjectRole.EVALUATOR))
			.doesNotThrowAnyException();
		assertThatThrownBy(() -> projectAccess.requireRole(project.getId(), ProjectRole.CO_SUPERVISOR))
			.isInstanceOf(AccessDeniedException.class);
	}

	@Test
	void roleInOneProjectGrantsNothingInAnother() {
		signInAs(lecturer);

		assertThatThrownBy(() -> projectAccess.requireRole(otherProject.getId(), ProjectRole.SUPERVISOR))
			.isInstanceOf(AccessDeniedException.class);
		assertThatCode(() -> projectAccess.requireRole(otherProject.getId(), ProjectRole.CO_SUPERVISOR))
			.doesNotThrowAnyException();

		signInAs(student);
		assertThatThrownBy(() -> projectAccess.requireMember(otherProject.getId()))
			.isInstanceOf(AccessDeniedException.class);
	}

	@Test
	void nonMemberAndUnknownProjectAreDeniedTheSameWay() {
		signInAs(outsider);

		assertThat(projectAccess.isCurrentUserMember(project.getId())).isFalse();
		assertThatThrownBy(() -> projectAccess.requireMember(project.getId()))
			.isInstanceOf(AccessDeniedException.class);
		assertThatThrownBy(() -> projectAccess.requireMember(UUID.randomUUID()))
			.isInstanceOf(AccessDeniedException.class);
	}

	@Test
	void inactiveMembershipGrantsNoAccess() {
		ProjectMember membership = memberRepository
			.findByUserIdAndProjectIdAndProjectRole(student.getId(), project.getId(), ProjectRole.STUDENT)
			.orElseThrow();
		membership.setActive(false);
		memberRepository.saveAndFlush(membership);
		signInAs(student);

		assertThat(projectAccess.getCurrentUserRoles(project.getId())).isEmpty();
		assertThatThrownBy(() -> projectAccess.requireMember(project.getId()))
			.isInstanceOf(AccessDeniedException.class);
		assertThatThrownBy(() -> projectAccess.requireRole(project.getId(), ProjectRole.STUDENT))
			.isInstanceOf(AccessDeniedException.class);
	}

	private User savedAdmin() {
		User admin = SharedTestData.staff();
		admin.setSystemRole(SystemRole.ADMIN);
		return userRepository.saveAndFlush(admin);
	}

	@Test
	void adminWithoutMembershipFailsEveryNormalProjectCheck() {
		User admin = savedAdmin();
		signInAs(admin);

		assertThat(projectAccess.isCurrentUserAdmin()).isTrue();
		assertThat(projectAccess.isCurrentUserMember(project.getId())).isFalse();
		assertThat(projectAccess.getCurrentUserRoles(project.getId())).isEmpty();
		assertThat(projectAccess.getRoles(admin.getId(), project.getId())).isEmpty();
		assertThat(projectAccess.isMember(admin.getId(), project.getId())).isFalse();
		assertThat(projectAccess.currentUserHasAnyRole(project.getId(), ProjectRole.values())).isFalse();

		assertThatThrownBy(() -> projectAccess.requireMember(project.getId()))
			.isInstanceOf(AccessDeniedException.class);
		assertThatThrownBy(() -> projectAccess.requireAnyRole(project.getId(), ProjectRole.values()))
			.isInstanceOf(AccessDeniedException.class);
		for (ProjectRole role : ProjectRole.values()) {
			assertThat(projectAccess.currentUserHasRole(project.getId(), role)).as(role.name()).isFalse();
			assertThat(projectAccess.hasRole(admin.getId(), project.getId(), role)).as(role.name()).isFalse();
			assertThatThrownBy(() -> projectAccess.requireRole(project.getId(), role)).as(role.name())
				.isInstanceOf(AccessDeniedException.class);
		}
	}

	@Test
	void memberOrAdminIsTheOnlyCheckThatLetsANonMemberAdminThrough() {
		signInAs(savedAdmin());

		assertThatCode(() -> projectAccess.requireMemberOrAdmin(project.getId())).doesNotThrowAnyException();
		assertThatCode(projectAccess::requireAdmin).doesNotThrowAnyException();

		// Passing the opt-in check grants no membership or role afterwards.
		assertThat(projectAccess.getCurrentUserRoles(project.getId())).isEmpty();
		assertThatThrownBy(() -> projectAccess.requireMember(project.getId()))
			.isInstanceOf(AccessDeniedException.class);
	}

	@Test
	void adminWhoIsAMemberGetsOnlyTheRolesOfThatMembership() {
		User admin = savedAdmin();
		memberRepository.saveAndFlush(new ProjectMember(admin, project, ProjectRole.EVALUATOR));
		signInAs(admin);

		assertThat(projectAccess.getCurrentUserRoles(project.getId())).containsExactly(ProjectRole.EVALUATOR);
		assertThatCode(() -> projectAccess.requireMember(project.getId())).doesNotThrowAnyException();
		assertThatCode(() -> projectAccess.requireRole(project.getId(), ProjectRole.EVALUATOR))
			.doesNotThrowAnyException();
		assertThatThrownBy(() -> projectAccess.requireRole(project.getId(), ProjectRole.SUPERVISOR))
			.isInstanceOf(AccessDeniedException.class);
		assertThatThrownBy(() -> projectAccess.requireMember(otherProject.getId()))
			.isInstanceOf(AccessDeniedException.class);
	}

	@Test
	void nonAdminIsNotAnAdmin() {
		signInAs(lecturer);

		assertThat(projectAccess.isCurrentUserAdmin()).isFalse();
		assertThatThrownBy(projectAccess::requireAdmin).isInstanceOf(AccessDeniedException.class);
		assertThatCode(() -> projectAccess.requireMemberOrAdmin(project.getId())).doesNotThrowAnyException();
		assertThatThrownBy(() -> projectAccess.requireMemberOrAdmin(UUID.randomUUID()))
			.isInstanceOf(AccessDeniedException.class);
	}

	@Test
	void checksOnTheCurrentUserNeedASignedInUser() {
		assertThatThrownBy(() -> projectAccess.requireMember(project.getId()))
			.isInstanceOf(AuthenticationException.class);
		assertThatThrownBy(() -> projectAccess.currentUserHasRole(project.getId(), ProjectRole.STUDENT))
			.isInstanceOf(AuthenticationException.class);
		assertThatThrownBy(projectAccess::isCurrentUserAdmin).isInstanceOf(AuthenticationException.class);
	}

}
