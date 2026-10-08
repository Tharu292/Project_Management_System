package com.researchpms.backend.c4;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.researchpms.backend.shared.SharedTestData;
import com.researchpms.backend.shared.project.Project;
import com.researchpms.backend.shared.project.ProjectMember;
import com.researchpms.backend.shared.project.ProjectRole;
import com.researchpms.backend.shared.project.ProjectStatus;
import com.researchpms.backend.shared.user.User;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Group discovery through the real endpoint: a user sees their own active
 * groups, with the roles that fit their account, and nothing about anyone else.
 */
class C4MyGroupsTest extends C4TestSupport {

	private static final String MY_GROUPS = "/api/v1/c4/me/groups";

	private ResultActions myGroups(User caller) throws Exception {
		return as(caller, get(MY_GROUPS));
	}

	private List<Map<String, Object>> groupsOf(User caller) throws Exception {
		return JsonPath.read(body(myGroups(caller).andExpect(status().isOk())), "$[*]");
	}

	private static Map<String, Object> only(List<Map<String, Object>> groups) {
		assertThat(groups).hasSize(1);
		return groups.get(0);
	}

	// ---- what each kind of user sees ----

	@Test
	void aStudentSeesTheirOwnGroupWithTheStudentRole() throws Exception {
		Map<String, Object> group = only(groupsOf(studentA));

		assertThat(group).containsEntry("projectId", group1.getId().toString())
			.containsEntry("projectCode", group1.getProjectCode())
			.containsEntry("title", group1.getTitle())
			.containsEntry("status", "ACTIVE")
			.containsEntry("roles", List.of("STUDENT"));
		assertThat(only(groupsOf(studentC))).containsEntry("projectId", group2.getId().toString());
	}

	@Test
	void staffSeeEachAssignedGroupWithTheRoleTheyHoldThere() throws Exception {
		// The supervisor of group 1 also evaluates group 2: two groups, one role in each.
		List<Map<String, Object>> groups = groupsOf(supervisor);
		assertThat(groups).hasSize(2);
		assertThat(groups).anySatisfy(group -> assertThat(group).containsEntry("projectId", group1.getId().toString())
			.containsEntry("roles", List.of("SUPERVISOR")));
		assertThat(groups).anySatisfy(group -> assertThat(group).containsEntry("projectId", group2.getId().toString())
			.containsEntry("roles", List.of("EVALUATOR")));

		assertThat(only(groupsOf(coSupervisor))).containsEntry("projectId", group1.getId().toString())
			.containsEntry("roles", List.of("CO_SUPERVISOR"));
		assertThat(only(groupsOf(evaluator))).containsEntry("projectId", group1.getId().toString())
			.containsEntry("roles", List.of("EVALUATOR"));
	}

	@Test
	void groupsAreListedInAStableOrderByProjectCode() throws Exception {
		List<String> codes = JsonPath.read(body(myGroups(supervisor)), "$[*].projectCode");

		assertThat(codes).isSorted().hasSize(2);
	}

	@Test
	void aGroupThatIsNoLongerActiveIsStillListedWithItsStatus() throws Exception {
		group1.setStatus(ProjectStatus.COMPLETED);
		projectRepository.saveAndFlush(group1);

		assertThat(only(groupsOf(studentA))).containsEntry("status", "COMPLETED");
	}

	// ---- who gets nothing ----

	@Test
	void aUserWithNoGroupsGetsAnEmptyList() throws Exception {
		User newStudent = userRepository.saveAndFlush(SharedTestData.student());
		User newLecturer = userRepository.saveAndFlush(SharedTestData.staff());

		myGroups(newStudent).andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
		myGroups(newLecturer).andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
	}

	@Test
	void administratorsGetNoGroupsEvenWithAMembershipRow() throws Exception {
		myGroups(admin).andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
		// This administrator has SUPERVISOR and STUDENT rows in group 1. Neither counts.
		myGroups(adminWithStrayMembership).andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
	}

	@Test
	void aRemovedMemberNoLongerSeesTheGroup() throws Exception {
		myGroups(removedStudent).andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
	}

	@Test
	void aRoleThatDoesNotFitTheAccountDoesNotOpenAGroup() throws Exception {
		// Data errors: a lecturer given the STUDENT role, and a student given a staff role.
		User lecturerAsStudent = member(SharedTestData.staff(), group1, ProjectRole.STUDENT);
		User studentAsSupervisor = member(SharedTestData.student(), group1, ProjectRole.SUPERVISOR);
		User studentAsEvaluator = member(SharedTestData.student(), group2, ProjectRole.EVALUATOR);

		for (User mismatched : new User[] { lecturerAsStudent, studentAsSupervisor, studentAsEvaluator }) {
			myGroups(mismatched).andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
		}
	}

	@Test
	void onlyTheRolesThatFitTheAccountAreReported() throws Exception {
		// A student who was also, wrongly, given a staff role in the same group is just a student there.
		memberRepository.saveAndFlush(new ProjectMember(studentA, group1, ProjectRole.EVALUATOR));

		assertThat(only(groupsOf(studentA))).containsEntry("roles", List.of("STUDENT"));
	}

	@Test
	void someoneHoldingBothAssessmentSidesInOneGroupIsShownBothSoTheClientCanRefuseMarking() throws Exception {
		assertThat(only(groupsOf(conflictedStaff))).containsEntry("roles", List.of("SUPERVISOR", "EVALUATOR"));
	}

	// ---- the caller is always the token's owner ----

	@Test
	void theEndpointCannotBeAskedAboutAnotherUser() throws Exception {
		String asStudentA = body(as(studentA, get(MY_GROUPS).param("userId", supervisor.getId().toString())
			.param("studentId", studentC.getId().toString())
			.param("projectId", group2.getId().toString())).andExpect(status().isOk()));

		List<Map<String, Object>> groups = JsonPath.read(asStudentA, "$[*]");
		assertThat(only(groups)).containsEntry("projectId", group1.getId().toString())
			.containsEntry("roles", List.of("STUDENT"));
		assertThat(asStudentA).doesNotContain(group2.getId().toString());
		// There is no per-user variant of the path.
		as(studentA, get(MY_GROUPS + "/" + supervisor.getId())).andExpect(status().isNotFound());
		as(studentA, get("/api/v1/c4/users/" + supervisor.getId() + "/groups")).andExpect(status().isNotFound());
	}

	@Test
	void theResponseCarriesOnlyWhatNavigationNeeds() throws Exception {
		for (User caller : new User[] { studentA, supervisor, evaluator }) {
			String body = body(myGroups(caller).andExpect(status().isOk()));

			List<Map<String, Object>> groups = JsonPath.read(body, "$[*]");
			for (Map<String, Object> group : groups) {
				assertThat(group.keySet()).containsExactlyInAnyOrder("projectId", "projectCode", "title", "status",
						"roles");
			}
			// Nothing about the other members of the group.
			for (User other : new User[] { studentA, studentB, studentC, supervisor, coSupervisor, evaluator,
					secondEvaluator }) {
				assertThat(body).doesNotContain(other.getId().toString()).doesNotContain(other.getEmail());
			}
		}
	}

	@Test
	void aStudentIsNotShownGroupsTheyDoNotBelongTo() throws Exception {
		Project unrelated = projectRepository.saveAndFlush(SharedTestData.project());
		member(SharedTestData.student(), unrelated, ProjectRole.STUDENT);

		String body = body(myGroups(studentA).andExpect(status().isOk()));

		assertThat(body).doesNotContain(group2.getId().toString())
			.doesNotContain(unrelated.getId().toString())
			.doesNotContain(unrelated.getProjectCode());
	}

	// ---- authentication ----

	@Test
	void groupDiscoveryRequiresASignedInUserWhoHasChangedTheirPassword() throws Exception {
		myGroups(null).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.status").value(401));
		as(null, get(MY_GROUPS).header("Authorization", "Bearer not-a-jwt")).andExpect(status().isUnauthorized());
		myGroups(flaggedStudent).andExpect(status().isForbidden())
			.andExpect(jsonPath("$.message").value("You must change your password before continuing."));
	}

	@Test
	void groupDiscoveryIsReadOnly() throws Exception {
		long before = memberRepository.count();

		as(studentA, post(MY_GROUPS)).andExpect(status().isMethodNotAllowed());
		myGroups(studentA).andExpect(status().isOk());

		assertThat(memberRepository.count()).isEqualTo(before);
	}

}
