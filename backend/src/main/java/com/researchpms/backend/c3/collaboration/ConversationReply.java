package com.researchpms.backend.c3.collaboration;

import com.researchpms.backend.shared.common.BaseEntity;
import com.researchpms.backend.shared.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** A reply in a conversation, by a supervisor, a co-supervisor or a student of the project. */
@Entity
@Table(name = "c3_conversation_reply")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ConversationReply extends BaseEntity {

	@Column(name = "conversation_id", nullable = false, updatable = false)
	private UUID conversationId;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "author_id", nullable = false, updatable = false)
	private User author;

	@Column(name = "body", nullable = false, updatable = false)
	private String body;

	public ConversationReply(UUID conversationId, User author, String body) {
		this.conversationId = conversationId;
		this.author = author;
		this.body = body;
	}

}
