package com.researchpms.backend.c4;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import com.researchpms.backend.c4.assessment.AssessmentConfigEntry;
import com.researchpms.backend.c4.assessment.AssessmentSide;
import com.researchpms.backend.c4.assessment.AssessmentTestFixtures;
import com.researchpms.backend.c4.assessment.evaluator.EvaluatorMarkTestFixtures;
import com.researchpms.backend.c4.assessment.supervisor.SupervisorMarkTestFixtures;
import com.researchpms.backend.c4.contribution.ContributionSnapshot;
import com.researchpms.backend.c4.contribution.ContributionSnapshotRepository;
import com.researchpms.backend.c4.contribution.ScoringConfigRepository;
import com.researchpms.backend.c4.wellbeing.WellbeingTestFixtures;
import com.researchpms.backend.shared.SharedTestData;
import com.researchpms.backend.shared.auth.AuthApiTestSupport;
import com.researchpms.backend.shared.project.Project;
import com.researchpms.backend.shared.project.ProjectMember;
import com.researchpms.backend.shared.project.ProjectMemberRepository;
import com.researchpms.backend.shared.project.ProjectRepository;
import com.researchpms.backend.shared.project.ProjectRole;
import com.researchpms.backend.shared.security.JwtService;
import com.researchpms.backend.shared.user.SystemRole;
import com.researchpms.backend.shared.user.User;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Two project groups and one of every kind of caller, built fresh for each
 * test and rolled back afterwards. Everything here is test-only data; no
 * account, mark or reflection is real.
 *
 * <pre>
 * Group 1: students A and B; supervisor, co-supervisor; two evaluators;
 *          a removed student; a student who must still change their password;
 *          a staff member wrongly holding SUPERVISOR and EVALUATOR together.
 * Group 2: student C. The supervisor of group 1 is an evaluator here, which is allowed.
 * </pre>
 */
abstract class C4TestSupport extends AuthApiTestSupport {

	protected static final String API = "/api/test/c4";

	@Autowired
	protected JwtService jwtService;

	@Autowired
	protected ProjectRepository projectRepository;

	@Autowired
	protected ProjectMemberRepository memberRepository;

	@Autowired
	protected ContributionSnapshotRepository snapshotRepository;

	@Autowired
	protected ScoringConfigRepository scoringConfigRepository;

	@Autowired
	protected WellbeingTestFixtures wellbeing;

	@Autowired
	protected AssessmentTestFixtures assessment;

	@Autowired
	protected SupervisorMarkTestFixtures supervisorMarks;

	@Autowired
	protected EvaluatorMarkTestFixtures evaluatorMarks;

	protected Project group1;

	protected Project group2;

	protected User studentA;

	protected User studentB;

	protected User studentC;

	protected User removedStudent;

	protected User flaggedStudent;

	protected User supervisor;

	protected User coSupervisor;

	protected User evaluator;

	protected User secondEvaluator;

	protected User conflictedStaff;

	protected User admin;

	protected User adminWithStrayMembership;

	protected AssessmentConfigEntry supervisorEntry;

	protected AssessmentConfigEntry evaluatorEntry;

	@BeforeEach
	void setUpGroups() {
		group1 = projectRepository.saveAndFlush(SharedTestData.project());
		group2 = projectRepository.saveAndFlush(SharedTestData.project());

		studentA = member(SharedTestData.student(), group1, ProjectRole.STUDENT);
		studentB = member(SharedTestData.student(), group1, ProjectRole.STUDENT);
		studentC = member(SharedTestData.student(), group2, ProjectRole.STUDENT);

		removedStudent = userRepository.saveAndFlush(SharedTestData.student());
		ProjectMember removed = new ProjectMember(removedStudent, group1, ProjectRole.STUDENT);
		removed.setActive(false);
		memberRepository.saveAndFlush(removed);

		User mustChange = SharedTestData.student();
		mustChange.setMustChangePassword(true);
		flaggedStudent = member(mustChange, group1, ProjectRole.STUDENT);

		supervisor = member(SharedTestData.staff(), group1, ProjectRole.SUPERVISOR);
		memberRepository.saveAndFlush(new ProjectMember(supervisor, group2, ProjectRole.EVALUATOR));
		coSupervisor = member(SharedTestData.staff(), group1, ProjectRole.CO_SUPERVISOR);
		evaluator = member(SharedTestData.staff(), group1, ProjectRole.EVALUATOR);
		secondEvaluator = member(SharedTestData.staff(), group1, ProjectRole.EVALUATOR);

		conflictedStaff = member(SharedTestData.staff(), group1, ProjectRole.SUPERVISOR);
		memberRepository.saveAndFlush(new ProjectMember(conflictedStaff, group1, ProjectRole.EVALUATOR));

		admin = userRepository.saveAndFlush(newAdmin());
		adminWithStrayMembership = member(newAdmin(), group1, ProjectRole.SUPERVISOR);
		memberRepository.saveAndFlush(new ProjectMember(adminWithStrayMembership, group1, ProjectRole.STUDENT));

		supervisorEntry = assessment.entry(AssessmentSide.SUPERVISOR);
		evaluatorEntry = assessment.entry(AssessmentSide.EVALUATOR);
	}

	private static User newAdmin() {
		User user = SharedTestData.staff();
		user.setSystemRole(SystemRole.ADMIN);
		return user;
	}

	protected User member(User user, Project project, ProjectRole role) {
		User saved = userRepository.saveAndFlush(user);
		memberRepository.saveAndFlush(new ProjectMember(saved, project, role));
		return saved;
	}

	protected UUID snapshot(Project project, User student, String indicator) {
		return snapshotRepository
			.saveAndFlush(new ContributionSnapshot(project.getId(), student.getId(), LocalDate.of(2026, 9, 1),
					LocalDate.of(2026, 9, 30), scoringConfigRepository.findByActiveTrue().orElseThrow(),
					"{\"COMMITS\": {\"state\": \"VALUE\", \"count\": 7}}", new BigDecimal("70.00"), null,
					new BigDecimal("50.00"), new BigDecimal(indicator), "{\"TASKS\": \"UNAVAILABLE\"}", true,
					Instant.now()))
			.getId();
	}

	/** A request as the given user, or with no token when the user is null. */
	protected ResultActions as(User caller, MockHttpServletRequestBuilder request) throws Exception {
		if (caller != null) {
			request.header(HttpHeaders.AUTHORIZATION, "Bearer " + jwtService.generateToken(caller));
		}
		return mockMvc.perform(request);
	}

	protected ResultActions getAs(User caller, String path) throws Exception {
		return as(caller, get(API + path));
	}

	protected ResultActions postAs(User caller, String path) throws Exception {
		return as(caller, post(API + path));
	}

	protected ResultActions putAs(User caller, String path, String json) throws Exception {
		return as(caller, put(API + path).contentType(MediaType.APPLICATION_JSON).content(json));
	}

	protected static String body(ResultActions result) throws Exception {
		return result.andReturn().getResponse().getContentAsString();
	}

	protected static String g(Project project) {
		return "/projects/" + project.getId();
	}

	protected static String mine(Project project) {
		return "/me/projects/" + project.getId();
	}

}
