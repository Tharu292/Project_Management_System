package com.researchpms.backend.shared.project;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectRepository extends JpaRepository<Project, UUID> {

	Optional<Project> findByProjectCode(String projectCode);

	boolean existsByProjectCode(String projectCode);

}
