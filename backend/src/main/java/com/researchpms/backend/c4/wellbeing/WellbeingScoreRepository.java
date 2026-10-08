package com.researchpms.backend.c4.wellbeing;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface WellbeingScoreRepository extends JpaRepository<WellbeingScore, UUID> {

	/** One owner's weekly values, newest first. */
	List<WellbeingScore> findByReflectionStudentIdAndReflectionProjectIdOrderByReflectionIsoYearDescReflectionIsoWeekDesc(
			UUID studentId, UUID projectId);

}
