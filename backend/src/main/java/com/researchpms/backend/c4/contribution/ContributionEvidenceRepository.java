package com.researchpms.backend.c4.contribution;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ContributionEvidenceRepository extends JpaRepository<ContributionEvidence, UUID> {

	List<ContributionEvidence> findByProjectIdAndStudentIdOrderByOccurredAtDesc(UUID projectId, UUID studentId);

	/** Activity that could not be matched to a student of the project. */
	List<ContributionEvidence> findByProjectIdAndStudentIdIsNullOrderByOccurredAtDesc(UUID projectId);

}
