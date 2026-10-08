package com.researchpms.backend.c4.contribution;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ScoringConfigRepository extends JpaRepository<ScoringConfig, UUID> {

	Optional<ScoringConfig> findByActiveTrue();

	Optional<ScoringConfig> findByVersion(int version);

}
