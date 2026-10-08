package com.researchpms.backend.c4;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jayway.jsonpath.JsonPath;
import com.researchpms.backend.c4.assessment.AssessmentConfigEntry;
import com.researchpms.backend.c4.assessment.AssessmentSide;
import com.researchpms.backend.c4.assessment.AssessmentTestFixtures;
import com.researchpms.backend.c4.contribution.ContributionCategory;
import com.researchpms.backend.c4.contribution.ContributionEvidence;
import com.researchpms.backend.c4.contribution.ContributionEvidenceRepository;
import com.researchpms.backend.c4.contribution.EvidenceSource;
import com.researchpms.backend.c4.contribution.EvidenceType;
import com.researchpms.backend.c4.contribution.GithubIdentity;
import com.researchpms.backend.c4.contribution.GithubIdentityRepository;
import com.researchpms.backend.c4.contribution.PullRequestState;
import com.researchpms.backend.c4.contribution.RepositoryLink;
import com.researchpms.backend.c4.contribution.RepositoryLinkRepository;
import com.researchpms.backend.c4.contribution.ScoringConfig;
import com.researchpms.backend.c4.contribution.ScoringConfigRepository;
import com.researchpms.backend.c4.wellbeing.WellbeingTestFixtures;
import com.researchpms.backend.shared.SharedTestData;
import com.researchpms.backend.shared.project.Project;
import com.researchpms.backend.shared.project.ProjectRepository;
import com.researchpms.backend.shared.user.User;
import com.researchpms.backend.shared.user.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * The application context only starts if Flyway applied the Component 4
 * migrations and Hibernate accepted every entity against them, so any passing
 * test here proves both. The rest checks the rules the database itself keeps.
 * A statement that breaks a rule is always the last one in its test, because
 * PostgreSQL ends the transaction when it refuses one.
 */
@SpringBootTest
@Transactional
class C4SchemaTest {

	/** The smallest metric configuration the database accepts. The values mean nothing; they are for tests. */
	private static final String TEST_METRICS = "{\"METRIC_WEIGHTS\": {}, \"PULL_REQUEST_STATE_MULTIPLIERS\": {}}";

	private static final String INSERT_EVIDENCE = """
			insert into c4_contribution_evidence
			    (project_id, student_id, source, evidence_type, external_id, state, occurred_at)
			values (?1, ?2, 'GITHUB', ?3, ?4, ?5, now())
			""";

	@PersistenceContext
	private EntityManager entityManager;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ProjectRepository projectRepository;

	@Autowired
	private ScoringConfigRepository scoringConfigRepository;

	@Autowired
	private ContributionEvidenceRepository evidenceRepository;

	@Autowired
	private RepositoryLinkRepository repositoryLinkRepository;

	@Autowired
	private GithubIdentityRepository githubIdentityRepository;

	@Autowired
	private WellbeingTestFixtures wellbeing;

	@Autowired
	private AssessmentTestFixtures assessment;

	private User student;

	private User lecturer;

	private Project project;

	@BeforeEach
	void setUp() {
		student = userRepository.saveAndFlush(SharedTestData.student());
		lecturer = userRepository.saveAndFlush(SharedTestData.staff());
		project = projectRepository.saveAndFlush(SharedTestData.project());
	}

	private long rows(String table) {
		return ((Number) entityManager.createNativeQuery("select count(*) from " + table).getSingleResult())
			.longValue();
	}

	private void sql(String statement, Object... parameters) {
		var query = entityManager.createNativeQuery(statement);
		for (int index = 0; index < parameters.length; index++) {
			query.setParameter(index + 1, parameters[index]);
		}
		query.executeUpdate();
	}

	// ---- contribution ----

	@Test
	void theInitialCategoryWeightsAreFortyFortyTwenty() {
		ScoringConfig active = scoringConfigRepository.findByActiveTrue().orElseThrow();

		assertThat(active.getVersion()).isEqualTo(1);
		assertThat(active.weightOf(ContributionCategory.DEVELOPMENT)).isEqualByComparingTo("0.40");
		assertThat(active.weightOf(ContributionCategory.TASK_COMPLETION)).isEqualByComparingTo("0.40");
		assertThat(active.weightOf(ContributionCategory.COLLABORATION)).isEqualByComparingTo("0.20");
		assertThat(active.getNote()).containsIgnoringCase("not validated").containsIgnoringCase("configurable");
	}

	@Test
	void theInitialMetricWeightsAreTheConfirmedOnesAndAddUpToTheirCategory() {
		ScoringConfig active = scoringConfigRepository.findByActiveTrue().orElseThrow();
		Map<String, Number> weights = JsonPath.read(active.getMetricWeights(), "$.METRIC_WEIGHTS");

		// One weight per scored evidence type, and no others.
		assertThat(weights.keySet())
			.containsExactlyInAnyOrderElementsOf(Arrays.stream(EvidenceType.values()).map(EvidenceType::name).toList());
		assertThat(weights.get("COMMIT").doubleValue()).isEqualTo(0.30);
		assertThat(weights.get("PULL_REQUEST").doubleValue()).isEqualTo(0.10);
		assertThat(weights.get("COMPLETED_TASK").doubleValue()).isEqualTo(0.40);
		assertThat(weights.get("ISSUE_COMMENT").doubleValue()).isEqualTo(0.10);
		assertThat(weights.get("PULL_REQUEST_REVIEW").doubleValue()).isEqualTo(0.10);

		Map<ContributionCategory, BigDecimal> perCategory = new EnumMap<>(ContributionCategory.class);
		for (EvidenceType type : EvidenceType.values()) {
			perCategory.merge(type.getCategory(), BigDecimal.valueOf(weights.get(type.name()).doubleValue()),
					BigDecimal::add);
		}
		for (ContributionCategory category : ContributionCategory.values()) {
			assertThat(perCategory.get(category)).as(category.name()).isEqualByComparingTo(active.weightOf(category));
		}
	}

	@Test
	void everyPullRequestStateScoresAndTheMultipliersAreMarkedProvisional() {
		ScoringConfig active = scoringConfigRepository.findByActiveTrue().orElseThrow();
		Map<String, Number> multipliers = JsonPath.read(active.getMetricWeights(), "$.PULL_REQUEST_STATE_MULTIPLIERS");
		List<String> provisional = JsonPath.read(active.getMetricWeights(), "$.PROVISIONAL");

		assertThat(multipliers.keySet()).containsExactlyInAnyOrderElementsOf(
				Arrays.stream(PullRequestState.values()).map(PullRequestState::name).toList());
		assertThat(multipliers.get("MERGED").doubleValue()).isEqualTo(1.0);
		assertThat(multipliers.get("OPEN").doubleValue()).isEqualTo(0.6);
		assertThat(multipliers.get("CLOSED_UNMERGED").doubleValue()).isEqualTo(0.3);
		for (PullRequestState state : PullRequestState.values()) {
			assertThat(multipliers.get(state.name()).doubleValue()).as(state.name()).isPositive();
		}
		assertThat(provisional).containsExactly("PULL_REQUEST_STATE_MULTIPLIERS");
		assertThat(active.getNote()).contains("PROVISIONAL").containsIgnoringCase("research assumptions");
	}

	@Test
	void weightsAreVersionedAndANewVersionCanBeStored() {
		ScoringConfig next = scoringConfigRepository.saveAndFlush(new ScoringConfig(2, new BigDecimal("0.5000"),
				new BigDecimal("0.3000"), new BigDecimal("0.2000"), TEST_METRICS, "test", null));

		assertThat(scoringConfigRepository.findByVersion(2)).contains(next);
		assertThat(next.isActive()).isFalse();
		assertThat(scoringConfigRepository.findByActiveTrue().orElseThrow().getVersion()).isEqualTo(1);
	}

	@Test
	void weightsThatDoNotSumToOneAreRefused() {
		assertThatThrownBy(() -> scoringConfigRepository.saveAndFlush(new ScoringConfig(3, new BigDecimal("0.5000"),
				new BigDecimal("0.4000"), new BigDecimal("0.2000"), TEST_METRICS, "test", null)))
			.hasMessageContaining("ck_c4_scoring_config_weight_sum");
	}

	@Test
	void onlyOneVersionOfTheWeightsCanBeActive() {
		ScoringConfig second = new ScoringConfig(4, new BigDecimal("0.3400"), new BigDecimal("0.3300"),
				new BigDecimal("0.3300"), TEST_METRICS, "test", null);
		second.setActive(true);

		assertThatThrownBy(() -> scoringConfigRepository.saveAndFlush(second))
			.hasMessageContaining("uq_c4_scoring_config_one_active");
	}

	@Test
	void aWeightsVersionMustCarryMetricWeightsAndPullRequestMultipliers() {
		assertThatThrownBy(() -> scoringConfigRepository.saveAndFlush(new ScoringConfig(5, new BigDecimal("0.4000"),
				new BigDecimal("0.4000"), new BigDecimal("0.2000"), "{\"METRIC_WEIGHTS\": {}}", "test", null)))
			.hasMessageContaining("ck_c4_scoring_config_metric_weights");
	}

	// ---- pull-request evidence ----

	@Test
	void aPullRequestIsAcceptedInEachOfTheThreeStates() {
		for (PullRequestState state : PullRequestState.values()) {
			sql(INSERT_EVIDENCE, project.getId(), student.getId(), "PULL_REQUEST", "example/repo#" + state.ordinal(),
					state.name());
		}

		assertThat(rows("c4_contribution_evidence")).isEqualTo(3);
	}

	@Test
	void theDatabaseRefusesAPullRequestWithoutAState() {
		assertThatThrownBy(() -> sql("""
				insert into c4_contribution_evidence
				    (project_id, student_id, source, evidence_type, external_id, occurred_at)
				values (?1, ?2, 'GITHUB', 'PULL_REQUEST', 'example/repo#1', now())
				""", project.getId(), student.getId())).hasMessageContaining("ck_c4_contribution_evidence_state");
	}

	@Test
	void theDatabaseRefusesAPullRequestWhoseStateIsWrittenAsNull() {
		assertThatThrownBy(() -> sql("""
				insert into c4_contribution_evidence
				    (project_id, student_id, source, evidence_type, external_id, state, occurred_at)
				values (?1, ?2, 'GITHUB', 'PULL_REQUEST', 'example/repo#1', null, now())
				""", project.getId(), student.getId())).hasMessageContaining("ck_c4_contribution_evidence_state");
	}

	@Test
	void theDatabaseRefusesAnUnknownPullRequestState() {
		assertThatThrownBy(
				() -> sql(INSERT_EVIDENCE, project.getId(), student.getId(), "PULL_REQUEST", "example/repo#1", "DRAFT"))
			.hasMessageContaining("ck_c4_contribution_evidence_state");
	}

	@Test
	void theDatabaseRefusesAStateOnAnythingThatIsNotAPullRequest() {
		assertThatThrownBy(() -> sql(INSERT_EVIDENCE, project.getId(), student.getId(), "COMMIT", "sha-1", "MERGED"))
			.hasMessageContaining("ck_c4_contribution_evidence_state");
	}

	@Test
	void theDatabaseRefusesClearingTheStateOfAnExistingPullRequest() {
		sql(INSERT_EVIDENCE, project.getId(), student.getId(), "PULL_REQUEST", "example/repo#1", "OPEN");

		assertThatThrownBy(() -> sql("update c4_contribution_evidence set state = null where external_id = ?1",
				"example/repo#1"))
			.hasMessageContaining("ck_c4_contribution_evidence_state");
	}

	@Test
	void aPullRequestThatChangesStateStaysOneRecordInItsLatestState() {
		ContributionEvidence pullRequest = evidenceRepository.saveAndFlush(new ContributionEvidence(project.getId(),
				student.getId(), EvidenceSource.GITHUB, EvidenceType.PULL_REQUEST, "example/repo#7", null,
				PullRequestState.OPEN, Instant.now(), null));

		pullRequest.updatePullRequestState(PullRequestState.MERGED);
		evidenceRepository.saveAndFlush(pullRequest);
		entityManager.clear();

		List<ContributionEvidence> stored = evidenceRepository
			.findByProjectIdAndStudentIdOrderByOccurredAtDesc(project.getId(), student.getId());
		assertThat(stored).hasSize(1);
		assertThat(stored.get(0).getState()).isEqualTo(PullRequestState.MERGED);
		assertThat(stored.get(0).getId()).isEqualTo(pullRequest.getId());
	}

	@Test
	void theSamePullRequestCannotBeStoredAgainInAnotherState() {
		sql(INSERT_EVIDENCE, project.getId(), student.getId(), "PULL_REQUEST", "example/repo#7", "OPEN");

		assertThatThrownBy(
				() -> sql(INSERT_EVIDENCE, project.getId(), student.getId(), "PULL_REQUEST", "example/repo#7", "MERGED"))
			.hasMessageContaining("uq_c4_contribution_evidence");
	}

	@Test
	void onlyAPullRequestHasAStateAndItCanNeverBeCleared() {
		ContributionEvidence pullRequest = new ContributionEvidence(project.getId(), student.getId(),
				EvidenceSource.GITHUB, EvidenceType.PULL_REQUEST, "example/repo#8", null, PullRequestState.OPEN,
				Instant.now(), null);
		ContributionEvidence commit = new ContributionEvidence(project.getId(), student.getId(), EvidenceSource.GITHUB,
				EvidenceType.COMMIT, "sha-8", null, null, Instant.now(), null);

		assertThatThrownBy(() -> pullRequest.updatePullRequestState(null)).isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> commit.updatePullRequestState(PullRequestState.MERGED))
			.isInstanceOf(IllegalStateException.class);
		assertThat(pullRequest.getState()).isEqualTo(PullRequestState.OPEN);
		assertThat(commit.getState()).isNull();
	}

	@Test
	void evidenceKeepsEveryPullRequestStateAndStoresJson() {
		for (PullRequestState state : PullRequestState.values()) {
			evidenceRepository.saveAndFlush(new ContributionEvidence(project.getId(), student.getId(),
					EvidenceSource.GITHUB, EvidenceType.PULL_REQUEST, "pr-" + state, "https://example.test/pr", state,
					Instant.now(), null));
		}
		evidenceRepository.saveAndFlush(new ContributionEvidence(project.getId(), null, EvidenceSource.GITHUB,
				EvidenceType.COMMIT, "sha-unattributed", null, null, Instant.now(), null));
		entityManager.clear();

		List<ContributionEvidence> ofStudent = evidenceRepository
			.findByProjectIdAndStudentIdOrderByOccurredAtDesc(project.getId(), student.getId());
		assertThat(ofStudent).extracting(ContributionEvidence::getState)
			.containsExactlyInAnyOrder(PullRequestState.OPEN, PullRequestState.MERGED,
					PullRequestState.CLOSED_UNMERGED);
		assertThat(evidenceRepository.findByProjectIdAndStudentIdIsNullOrderByOccurredAtDesc(project.getId()))
			.hasSize(1);
		assertThatThrownBy(() -> new ContributionEvidence(project.getId(), student.getId(), EvidenceSource.GITHUB,
				EvidenceType.COMMIT, "sha-1", null, PullRequestState.MERGED, Instant.now(), null))
			.isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> new ContributionEvidence(project.getId(), student.getId(), EvidenceSource.GITHUB,
				EvidenceType.PULL_REQUEST, "pr-2", null, null, Instant.now(), null))
			.isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	void theSameExternalItemCannotBeStoredTwice() {
		evidenceRepository.saveAndFlush(new ContributionEvidence(project.getId(), student.getId(),
				EvidenceSource.GITHUB, EvidenceType.COMMIT, "sha-duplicate", null, null, Instant.now(), null));

		assertThatThrownBy(() -> evidenceRepository.saveAndFlush(new ContributionEvidence(project.getId(),
				student.getId(), EvidenceSource.GITHUB, EvidenceType.COMMIT, "sha-duplicate", null, null,
				Instant.now(), null)))
			.hasMessageContaining("uq_c4_contribution_evidence");
	}

	@Test
	void repositoryAndGithubNamesAreStoredLowerCased() {
		RepositoryLink link = repositoryLinkRepository
			.saveAndFlush(new RepositoryLink(project.getId(), " Example-Org ", "Research-Repo", lecturer.getId()));
		GithubIdentity identity = githubIdentityRepository
			.saveAndFlush(new GithubIdentity(student.getId(), " Student-Login-" + SharedTestData.unique()));

		assertThat(link.getRepoOwner()).isEqualTo("example-org");
		assertThat(link.getRepoName()).isEqualTo("research-repo");
		assertThat(identity.getGithubLogin()).startsWith("student-login-");
		assertThat(repositoryLinkRepository.findByProjectIdAndActiveTrue(project.getId())).containsExactly(link);
	}

	// ---- nothing is invented ----

	@Test
	void noMarkingStructureMappingOrThresholdShipsWithTheSchema() {
		for (String table : new String[] { "c4_assessment_config", "c4_assessment_config_entry",
				"c4_assessment_supervisor_mark", "c4_assessment_evaluator_mark", "c4_assessment_portfolio",
				"c4_emotion_score_mapping", "c4_wb_settings", "c4_wb_reflection", "c4_wb_summary",
				"c4_wb_sharing_preference", "c4_contribution_snapshot", "c4_contribution_evidence" }) {
			assertThat(rows(table)).as(table).isZero();
		}
		// The only seeded row anywhere is version 1 of the contribution weights.
		assertThat(rows("c4_scoring_config")).isEqualTo(1);
	}

	@Test
	void anAssessmentEntryNeedsNoWeight() {
		AssessmentConfigEntry entry = assessment.entry(AssessmentSide.SUPERVISOR);

		assertThat(entry.getWeightPercent()).isNull();
		assertThat(entry.getConfig().isActive()).isFalse();
	}

	// ---- assessment ----

	@Test
	void aSupervisorSideRecordCannotPointAtAnEvaluatorSideEntry() {
		AssessmentConfigEntry evaluatorEntry = assessment.entry(AssessmentSide.EVALUATOR);

		assertThatThrownBy(() -> sql("""
				insert into c4_assessment_supervisor_mark (project_id, student_id, config_entry_id, assessor_id)
				values (?1, ?2, ?3, ?4)
				""", project.getId(), student.getId(), evaluatorEntry.getId(), lecturer.getId()))
			.hasMessageContaining("fk_c4_assessment_supervisor_mark_entry");
	}

	@Test
	void anEvaluatorSideRecordCannotPointAtASupervisorSideEntry() {
		AssessmentConfigEntry supervisorEntry = assessment.entry(AssessmentSide.SUPERVISOR);

		assertThatThrownBy(() -> sql("""
				insert into c4_assessment_evaluator_mark (project_id, student_id, config_entry_id, assessor_id)
				values (?1, ?2, ?3, ?4)
				""", project.getId(), student.getId(), supervisorEntry.getId(), lecturer.getId()))
			.hasMessageContaining("fk_c4_assessment_evaluator_mark_entry");
	}

	@Test
	void aRecordCannotBeSubmittedWithoutAMark() {
		AssessmentConfigEntry entry = assessment.entry(AssessmentSide.SUPERVISOR);

		assertThatThrownBy(() -> sql("""
				insert into c4_assessment_supervisor_mark
					(project_id, student_id, config_entry_id, assessor_id, status, submitted_at)
				values (?1, ?2, ?3, ?4, 'SUBMITTED', now())
				""", project.getId(), student.getId(), entry.getId(), lecturer.getId()))
			.hasMessageContaining("ck_c4_assessment_supervisor_mark_submitted");
	}

	@Test
	void aDraftCannotBeReleased() {
		AssessmentConfigEntry entry = assessment.entry(AssessmentSide.EVALUATOR);

		assertThatThrownBy(() -> sql("""
				insert into c4_assessment_evaluator_mark
					(project_id, student_id, config_entry_id, assessor_id, mark_percent, released_at)
				values (?1, ?2, ?3, ?4, 70, now())
				""", project.getId(), student.getId(), entry.getId(), lecturer.getId()))
			.hasMessageContaining("ck_c4_assessment_evaluator_mark_released");
	}

	@Test
	void oneAssessorHasOneRecordPerStudentAndEntry() {
		AssessmentConfigEntry entry = assessment.entry(AssessmentSide.EVALUATOR);
		String insert = """
				insert into c4_assessment_evaluator_mark (project_id, student_id, config_entry_id, assessor_id)
				values (?1, ?2, ?3, ?4)
				""";
		sql(insert, project.getId(), student.getId(), entry.getId(), lecturer.getId());

		assertThatThrownBy(() -> sql(insert, project.getId(), student.getId(), entry.getId(), lecturer.getId()))
			.hasMessageContaining("uq_c4_assessment_evaluator_mark");
	}

	// ---- wellbeing ----

	@Test
	void sharingCannotBeSwitchedOnWithoutARecordedAcknowledgement() {
		assertThatThrownBy(() -> sql("""
				insert into c4_wb_sharing_preference (student_id, project_id, shared) values (?1, ?2, true)
				""", student.getId(), project.getId())).hasMessageContaining("ck_c4_wb_sharing_preference_consent");
	}

	@Test
	void sharingIsOffUnlessARowSaysOtherwise() {
		sql("insert into c4_wb_sharing_preference (student_id, project_id) values (?1, ?2)", student.getId(),
				project.getId());

		Object shared = entityManager
			.createNativeQuery("select shared from c4_wb_sharing_preference where student_id = ?1")
			.setParameter(1, student.getId())
			.getSingleResult();
		assertThat(shared).isEqualTo(false);
	}

	@Test
	void aStudentHasOneReflectionPerProjectAndWeek() {
		wellbeing.reflection(student.getId(), project.getId(), 41, "first");

		assertThatThrownBy(() -> wellbeing.reflection(student.getId(), project.getId(), 41, "second"))
			.hasMessageContaining("uq_c4_wb_reflection_week");
	}

	@Test
	void deletingAReflectionRemovesItsPredictionAndScore() {
		UUID reflection = wellbeing.reflection(student.getId(), project.getId(), 42, "to be deleted");
		wellbeing.predictionAndScore(reflection, "TEST_LABEL", "3.00");
		assertThat(wellbeing.predictionCount(reflection)).isEqualTo(1);
		long scoresBefore = wellbeing.scoreCount();
		entityManager.clear();

		wellbeing.deleteReflection(reflection);
		entityManager.clear();

		assertThat(wellbeing.predictionCount(reflection)).isZero();
		assertThat(wellbeing.scoreCount()).isEqualTo(scoresBefore - 1);
	}

	@Test
	void aWellbeingScoreStaysBetweenOneAndFive() {
		assertThatThrownBy(() -> sql("""
				insert into c4_wb_summary (student_id, project_id, status, score, trend)
				values (?1, ?2, 'DOING_WELL', 5.5, 'STABLE')
				""", student.getId(), project.getId())).hasMessageContaining("ck_c4_wb_summary_score");
	}

	@Test
	void theGroupVisibleSummaryTableHoldsNothingButTheThreeValues() {
		@SuppressWarnings("unchecked")
		List<String> columns = entityManager.createNativeQuery("""
				select column_name from information_schema.columns
				where table_schema = current_schema() and table_name = 'c4_wb_summary'
				""").getResultList();

		assertThat(columns).containsExactlyInAnyOrder("id", "student_id", "project_id", "status", "score", "trend",
				"created_at", "updated_at");
	}

}
