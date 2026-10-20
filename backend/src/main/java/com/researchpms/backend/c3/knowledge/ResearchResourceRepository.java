package com.researchpms.backend.c3.knowledge;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ResearchResourceRepository extends JpaRepository<ResearchResource, UUID> {

	boolean existsByIdAndProjectId(UUID id, UUID projectId);

	/**
	 * A project's resources, newest first. {@code pattern} is a lower-case LIKE
	 * pattern with {@code \} as escape character, or null for no text filter;
	 * {@code type} is null for every type.
	 */
	@Query("""
			select r from ResearchResource r
			where r.projectId = :projectId
			  and (:type is null or r.type = :type)
			  and (:pattern is null
			       or lower(r.title) like :pattern escape '\\'
			       or lower(coalesce(r.description, '')) like :pattern escape '\\'
			       or lower(coalesce(r.url, '')) like :pattern escape '\\')
			order by r.createdAt desc
			""")
	List<ResearchResource> search(@Param("projectId") UUID projectId, @Param("type") ResearchResource.Type type,
			@Param("pattern") String pattern);

}
