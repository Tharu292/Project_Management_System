package com.researchpms.backend.c4.wellbeing;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface RecommendationRepository extends JpaRepository<Recommendation, UUID> {

	List<Recommendation> findByStudentIdAndProjectIdOrderByIsoYearDescIsoWeekDesc(UUID studentId, UUID projectId);

}
