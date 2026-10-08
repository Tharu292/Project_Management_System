package com.researchpms.backend.c4.wellbeing;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface EmotionPredictionRepository extends JpaRepository<EmotionPrediction, UUID> {

	List<EmotionPrediction> findByReflectionId(UUID reflectionId);

}
