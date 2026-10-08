package com.researchpms.backend.c4.contribution;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RepositoryLinkRepository extends JpaRepository<RepositoryLink, UUID> {

	List<RepositoryLink> findByProjectIdAndActiveTrue(UUID projectId);

}
