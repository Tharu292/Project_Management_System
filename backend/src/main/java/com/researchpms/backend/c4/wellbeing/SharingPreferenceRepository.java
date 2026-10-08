package com.researchpms.backend.c4.wellbeing;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface SharingPreferenceRepository extends JpaRepository<SharingPreference, UUID> {

	Optional<SharingPreference> findByStudentIdAndProjectId(UUID studentId, UUID projectId);

	List<SharingPreference> findByProjectIdAndSharedTrue(UUID projectId);

}
