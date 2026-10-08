package com.researchpms.backend.c4.wellbeing;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Every lookup is by owner. There is deliberately no way to list a project's reflections. */
interface ReflectionRepository extends JpaRepository<Reflection, UUID> {

	List<Reflection> findByStudentIdAndProjectIdOrderByIsoYearDescIsoWeekDesc(UUID studentId, UUID projectId);

	Optional<Reflection> findByIdAndStudentIdAndProjectId(UUID id, UUID studentId, UUID projectId);

}
