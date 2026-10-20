package com.researchpms.backend.c3.collaboration;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConversationRepository extends JpaRepository<Conversation, UUID> {

	List<Conversation> findByProjectIdOrderByCreatedAtDesc(UUID projectId);

	boolean existsByIdAndProjectId(UUID id, UUID projectId);

}
