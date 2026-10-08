package com.researchpms.backend.c4.assessment.evaluator;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Assessor lookups always carry the assessor's id; student lookups only ever return released records. */
interface EvaluatorMarkRepository extends JpaRepository<EvaluatorMark, UUID> {

	List<EvaluatorMark> findByProjectIdAndAssessorIdOrderByCreatedAtAsc(UUID projectId, UUID assessorId);

	Optional<EvaluatorMark> findByIdAndProjectIdAndAssessorId(UUID id, UUID projectId, UUID assessorId);

	List<EvaluatorMark> findByProjectIdAndStudentIdAndReleasedAtIsNotNullOrderByReleasedAtAsc(UUID projectId,
			UUID studentId);

}
