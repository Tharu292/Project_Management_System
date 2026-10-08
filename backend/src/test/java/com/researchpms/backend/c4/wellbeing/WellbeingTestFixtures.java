package com.researchpms.backend.c4.wellbeing;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Test-only. Creates wellbeing rows directly, because the entities are
 * package-private and nothing outside the wellbeing package can. It lives
 * under src/test, so it is never part of the real application.
 */
@Component
public class WellbeingTestFixtures {

	private final ReflectionRepository reflections;

	private final EmotionPredictionRepository predictions;

	private final WellbeingScoreRepository scores;

	private final RecommendationRepository recommendations;

	private final WarningRepository warnings;

	private final SharingPreferenceRepository sharing;

	private final WellbeingSummaryRepository summaries;

	WellbeingTestFixtures(ReflectionRepository reflections, EmotionPredictionRepository predictions,
			WellbeingScoreRepository scores, RecommendationRepository recommendations, WarningRepository warnings,
			SharingPreferenceRepository sharing, WellbeingSummaryRepository summaries) {
		this.reflections = reflections;
		this.predictions = predictions;
		this.scores = scores;
		this.recommendations = recommendations;
		this.warnings = warnings;
		this.sharing = sharing;
		this.summaries = summaries;
	}

	/** Every answer contains {@code text}, so a test can look for it in places it must never appear. */
	public UUID reflection(UUID studentId, UUID projectId, int isoWeek, String text) {
		return reflections
			.saveAndFlush(new Reflection(studentId, projectId, 2026, isoWeek, "work " + text, "challenges " + text,
					"next " + text, "feeling " + text))
			.getId();
	}

	public void predictionAndScore(UUID reflectionId, String label, String score) {
		Reflection reflection = reflections.findById(reflectionId).orElseThrow();
		EmotionPrediction prediction = new EmotionPrediction(reflection, "test-model-1", "TEST_SCHEME");
		prediction.complete(label, "{\"" + label + "\": 1.25}", new BigDecimal("0.4200"));
		predictions.saveAndFlush(prediction);
		scores.saveAndFlush(new WellbeingScore(reflection, prediction, 1, new BigDecimal(score)));
	}

	public UUID recommendation(UUID studentId, UUID projectId, String message) {
		return recommendations
			.saveAndFlush(new Recommendation(studentId, projectId, 2026, 40, "TEST_RULE", message, "{}"))
			.getId();
	}

	public UUID warning(UUID studentId, UUID projectId, String message) {
		return warnings.saveAndFlush(new Warning(studentId, projectId, "TEST_RULE", message, "{}", Instant.now()))
			.getId();
	}

	public void optIn(UUID studentId, UUID projectId) {
		SharingPreference preference = sharing.findByStudentIdAndProjectId(studentId, projectId)
			.orElseGet(() -> new SharingPreference(studentId, projectId));
		preference.optIn("test-notice-1", Instant.now());
		sharing.saveAndFlush(preference);
	}

	/** Opts in and then withdraws, leaving a preference row that says "not shared". */
	public void optInThenWithdraw(UUID studentId, UUID projectId) {
		optIn(studentId, projectId);
		SharingPreference preference = sharing.findByStudentIdAndProjectId(studentId, projectId).orElseThrow();
		preference.withdraw();
		sharing.saveAndFlush(preference);
	}

	public void summary(UUID studentId, UUID projectId, WellbeingStatus status, String score, WellbeingTrend trend) {
		summaries.saveAndFlush(new WellbeingSummary(studentId, projectId, status, new BigDecimal(score), trend));
	}

	public void deleteReflection(UUID reflectionId) {
		reflections.deleteById(reflectionId);
		reflections.flush();
	}

	public long predictionCount(UUID reflectionId) {
		return predictions.findByReflectionId(reflectionId).size();
	}

	public long scoreCount() {
		return scores.count();
	}

}
