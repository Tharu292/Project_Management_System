package com.researchpms.backend.c4.wellbeing;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface WarningRepository extends JpaRepository<Warning, UUID> {

	List<Warning> findByStudentIdAndProjectIdOrderByRaisedAtDesc(UUID studentId, UUID projectId);

}
