package com.researchpms.backend.shared.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.researchpms.backend.shared.SharedTestData;
import com.researchpms.backend.shared.user.User;
import com.researchpms.backend.shared.user.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class ProjectMemberPersistenceTest {

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ProjectRepository projectRepository;

	@Autowired
	private ProjectMemberRepository memberRepository;

	@Autowired
	private EntityManager entityManager;

	private User student;

	private User lecturer;

	private Project project;

	@BeforeEach
	void setUp() {
		student = userRepository.saveAndFlush(SharedTestData.student());
		lecturer = userRepository.saveAndFlush(SharedTestData.staff());
		project = projectRepository.saveAndFlush(SharedTestData.project());
	}

	@Test
	void membershipLinksUserProjectAndRole() {
		ProjectMember saved = memberRepository.saveAndFlush(new ProjectMember(student, project, ProjectRole.STUDENT));
		entityManager.clear();

		ProjectMember reloaded = memberRepository.findById(saved.getId()).orElseThrow();
		assertThat(reloaded.getUser().getId()).isEqualTo(student.getId());
		assertThat(reloaded.getProject().getId()).isEqualTo(project.getId());
		assertThat(reloaded.getProjectRole()).isEqualTo(ProjectRole.STUDENT);
		assertThat(reloaded.isActive()).isTrue();
		assertThat(reloaded.getJoinedAt()).isNotNull();
	}

	@Test
	void sameUserMayHoldDifferentRolesInTheSameProject() {
		memberRepository.saveAndFlush(new ProjectMember(lecturer, project, ProjectRole.SUPERVISOR));
		memberRepository.saveAndFlush(new ProjectMember(lecturer, project, ProjectRole.EVALUATOR));

		assertThat(memberRepository.findByUserIdAndProjectIdAndActiveTrue(lecturer.getId(), project.getId()))
			.extracting(ProjectMember::getProjectRole)
			.containsExactlyInAnyOrder(ProjectRole.SUPERVISOR, ProjectRole.EVALUATOR);
	}

	@Test
	void identicalUserProjectRoleMembershipIsRejected() {
		memberRepository.saveAndFlush(new ProjectMember(student, project, ProjectRole.STUDENT));

		assertThatThrownBy(
				() -> memberRepository.saveAndFlush(new ProjectMember(student, project, ProjectRole.STUDENT)))
			.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void sameUserMayHoldDifferentRolesInDifferentProjects() {
		Project other = projectRepository.saveAndFlush(SharedTestData.project());
		memberRepository.saveAndFlush(new ProjectMember(lecturer, project, ProjectRole.SUPERVISOR));
		memberRepository.saveAndFlush(new ProjectMember(lecturer, other, ProjectRole.EVALUATOR));

		assertThat(memberRepository.findByUserIdAndActiveTrue(lecturer.getId())).hasSize(2);
		assertThat(memberRepository.existsByUserIdAndProjectIdAndProjectRoleAndActiveTrue(lecturer.getId(),
				other.getId(), ProjectRole.EVALUATOR))
			.isTrue();
		assertThat(memberRepository.existsByUserIdAndProjectIdAndProjectRoleAndActiveTrue(lecturer.getId(),
				other.getId(), ProjectRole.SUPERVISOR))
			.isFalse();
	}

	@Test
	void inactiveMembershipIsExcludedFromActiveLookupsButStillStored() {
		ProjectMember member = memberRepository.saveAndFlush(new ProjectMember(student, project, ProjectRole.STUDENT));
		member.setActive(false);
		memberRepository.saveAndFlush(member);
		entityManager.clear();

		assertThat(memberRepository.existsByUserIdAndProjectIdAndActiveTrue(student.getId(), project.getId()))
			.isFalse();
		assertThat(memberRepository.findByProjectIdAndActiveTrue(project.getId())).isEmpty();
		assertThat(memberRepository.findByUserIdAndProjectIdAndProjectRole(student.getId(), project.getId(),
				ProjectRole.STUDENT))
			.isPresent();
	}

	@Test
	void membersCanBeListedByProjectAndRole() {
		memberRepository.saveAndFlush(new ProjectMember(student, project, ProjectRole.STUDENT));
		memberRepository.saveAndFlush(new ProjectMember(lecturer, project, ProjectRole.SUPERVISOR));

		assertThat(memberRepository.findByProjectIdAndActiveTrue(project.getId())).hasSize(2);
		assertThat(memberRepository.findByProjectIdAndProjectRoleAndActiveTrue(project.getId(), ProjectRole.STUDENT))
			.extracting(member -> member.getUser().getId())
			.containsExactly(student.getId());
	}

	@Test
	void membershipCannotReferenceAMissingProject() {
		assertThatThrownBy(() -> entityManager
			.createNativeQuery("insert into project_members (user_id, project_id, project_role) "
					+ "values (:userId, gen_random_uuid(), 'STUDENT')")
			.setParameter("userId", student.getId())
			.executeUpdate()).hasMessageContaining("fk_project_members_project");
	}

}
