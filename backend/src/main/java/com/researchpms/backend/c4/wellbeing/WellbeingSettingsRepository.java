package com.researchpms.backend.c4.wellbeing;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface WellbeingSettingsRepository extends JpaRepository<WellbeingSettings, UUID> {

	Optional<WellbeingSettings> findByActiveTrue();

}
