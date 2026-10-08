package com.researchpms.backend.c4.wellbeing;

import com.researchpms.backend.c4.wellbeing.dto.MyRecommendationResponse;
import com.researchpms.backend.c4.wellbeing.dto.MyReflectionResponse;
import com.researchpms.backend.c4.wellbeing.dto.MyWarningResponse;
import com.researchpms.backend.c4.wellbeing.dto.MyWeeklyWellbeingResponse;
import com.researchpms.backend.shared.common.ResourceNotFoundException;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * A student's own reflections, predictions, weekly values, recommendations
 * and warnings. No method takes a student id: the owner is always the
 * signed-in student, and every query filters on that id in the database.
 * Another student's record id is answered as "not found".
 */
@Service
public class PrivateWellbeingService {

	private final WellbeingAccessService wellbeingAccess;

	private final ReflectionRepository reflectionRepository;

	private final WellbeingScoreRepository scoreRepository;

	private final RecommendationRepository recommendationRepository;

	private final WarningRepository warningRepository;

	PrivateWellbeingService(WellbeingAccessService wellbeingAccess, ReflectionRepository reflectionRepository,
			WellbeingScoreRepository scoreRepository, RecommendationRepository recommendationRepository,
			WarningRepository warningRepository) {
		this.wellbeingAccess = wellbeingAccess;
		this.reflectionRepository = reflectionRepository;
		this.scoreRepository = scoreRepository;
		this.recommendationRepository = recommendationRepository;
		this.warningRepository = warningRepository;
	}

	@Transactional(readOnly = true)
	public List<MyReflectionResponse> myReflections(UUID projectId) {
		UUID owner = wellbeingAccess.requireOwner(projectId);
		return reflectionRepository.findByStudentIdAndProjectIdOrderByIsoYearDescIsoWeekDesc(owner, projectId)
			.stream()
			.map(PrivateWellbeingService::toResponse)
			.toList();
	}

	@Transactional(readOnly = true)
	public MyReflectionResponse myReflection(UUID projectId, UUID reflectionId) {
		UUID owner = wellbeingAccess.requireOwner(projectId);
		return reflectionRepository.findByIdAndStudentIdAndProjectId(reflectionId, owner, projectId)
			.map(PrivateWellbeingService::toResponse)
			.orElseThrow(() -> new ResourceNotFoundException("Reflection not found."));
	}

	/** The owner's weekly predicted emotions and values, newest first. */
	@Transactional(readOnly = true)
	public List<MyWeeklyWellbeingResponse> myWeeklyWellbeing(UUID projectId) {
		UUID owner = wellbeingAccess.requireOwner(projectId);
		return scoreRepository
			.findByReflectionStudentIdAndReflectionProjectIdOrderByReflectionIsoYearDescReflectionIsoWeekDesc(owner,
					projectId)
			.stream()
			.map(score -> new MyWeeklyWellbeingResponse(score.getReflection().getIsoYear(),
					score.getReflection().getIsoWeek(), score.getPrediction().getPredictedLabel(),
					score.getPrediction().getLabelScheme(), score.getPrediction().getMargin(),
					score.getPrediction().getModelVersion(), score.getScore()))
			.toList();
	}

	@Transactional(readOnly = true)
	public List<MyRecommendationResponse> myRecommendations(UUID projectId) {
		UUID owner = wellbeingAccess.requireOwner(projectId);
		return recommendationRepository.findByStudentIdAndProjectIdOrderByIsoYearDescIsoWeekDesc(owner, projectId)
			.stream()
			.map(item -> new MyRecommendationResponse(item.getId(), item.getIsoYear(), item.getIsoWeek(),
					item.getRuleCode(), item.getMessage()))
			.toList();
	}

	@Transactional(readOnly = true)
	public List<MyWarningResponse> myWarnings(UUID projectId) {
		UUID owner = wellbeingAccess.requireOwner(projectId);
		return warningRepository.findByStudentIdAndProjectIdOrderByRaisedAtDesc(owner, projectId)
			.stream()
			.map(item -> new MyWarningResponse(item.getId(), item.getRuleCode(), item.getMessage(),
					item.getRaisedAt(), item.getReadAt()))
			.toList();
	}

	private static MyReflectionResponse toResponse(Reflection reflection) {
		return new MyReflectionResponse(reflection.getId(), reflection.getIsoYear(), reflection.getIsoWeek(),
				reflection.getWorkDone(), reflection.getChallenges(), reflection.getNextSteps(),
				reflection.getProgressFeeling(), reflection.getCreatedAt(), reflection.getUpdatedAt());
	}

}
