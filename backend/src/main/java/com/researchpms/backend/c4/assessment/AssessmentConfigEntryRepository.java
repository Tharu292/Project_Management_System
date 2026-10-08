package com.researchpms.backend.c4.assessment;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AssessmentConfigEntryRepository extends JpaRepository<AssessmentConfigEntry, UUID> {

	List<AssessmentConfigEntry> findByConfigIdOrderByDisplayOrderAsc(UUID configId);

}
