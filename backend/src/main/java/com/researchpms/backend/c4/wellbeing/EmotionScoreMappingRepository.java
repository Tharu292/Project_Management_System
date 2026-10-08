package com.researchpms.backend.c4.wellbeing;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface EmotionScoreMappingRepository extends JpaRepository<EmotionScoreMapping, UUID> {

	List<EmotionScoreMapping> findByMappingVersionAndLabelScheme(int mappingVersion, String labelScheme);

}
