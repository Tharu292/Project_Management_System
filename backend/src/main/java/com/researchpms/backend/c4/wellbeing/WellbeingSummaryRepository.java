package com.researchpms.backend.c4.wellbeing;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface WellbeingSummaryRepository extends JpaRepository<WellbeingSummary, UUID> {

	List<WellbeingSummary> findByProjectId(UUID projectId);

	Optional<WellbeingSummary> findByStudentIdAndProjectId(UUID studentId, UUID projectId);

}
