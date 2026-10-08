package com.researchpms.backend.c4.assessment;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AssessmentPortfolioRepository extends JpaRepository<AssessmentPortfolio, UUID> {

	List<AssessmentPortfolio> findByProjectIdAndStudentIdOrderByGeneratedAtDesc(UUID projectId, UUID studentId);

}
