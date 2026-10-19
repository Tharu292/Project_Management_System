package com.researchpms.backend.shared.project;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectMemberRepository extends JpaRepository<ProjectMember, UUID> {

	/** All active roles a user holds in a project; may contain more than one row. */
	List<ProjectMember> findByUserIdAndProjectIdAndActiveTrue(UUID userId, UUID projectId);

	boolean existsByUserIdAndProjectIdAndActiveTrue(UUID userId, UUID projectId);

	boolean existsByUserIdAndProjectIdAndProjectRoleAndActiveTrue(UUID userId, UUID projectId, ProjectRole projectRole);

	/** Includes inactive rows, so a removed membership can be reactivated instead of duplicated. */
	Optional<ProjectMember> findByUserIdAndProjectIdAndProjectRole(UUID userId, UUID projectId, ProjectRole projectRole);

	List<ProjectMember> findByProjectIdAndActiveTrue(UUID projectId);

	List<ProjectMember> findByProjectIdAndProjectRoleAndActiveTrue(UUID projectId, ProjectRole projectRole);

	List<ProjectMember> findByUserIdAndActiveTrue(UUID userId);

}
