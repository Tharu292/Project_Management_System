package com.researchpms.backend.c4.assessment;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AssessmentConfigRepository extends JpaRepository<AssessmentConfig, UUID> {

	Optional<AssessmentConfig> findByActiveTrue();

}
