package com.researchpms.backend.c4.assessment.supervisor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Assessor lookups always carry the assessor's id; student lookups only ever return released records. */
interface SupervisorMarkRepository extends JpaRepository<SupervisorMark, UUID> {

	List<SupervisorMark> findByProjectIdAndAssessorIdOrderByCreatedAtAsc(UUID projectId, UUID assessorId);

	Optional<SupervisorMark> findByIdAndProjectIdAndAssessorId(UUID id, UUID projectId, UUID assessorId);

	List<SupervisorMark> findByProjectIdAndStudentIdAndReleasedAtIsNotNullOrderByReleasedAtAsc(UUID projectId,
			UUID studentId);

}
