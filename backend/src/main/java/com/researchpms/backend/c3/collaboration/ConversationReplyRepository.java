package com.researchpms.backend.c3.collaboration;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConversationReplyRepository extends JpaRepository<ConversationReply, UUID> {

	List<ConversationReply> findByConversationIdOrderByCreatedAtAsc(UUID conversationId);

	List<ConversationReply> findByConversationIdIn(Collection<UUID> conversationIds);

}
