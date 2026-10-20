package com.researchpms.backend.c3.collaboration;

import com.researchpms.backend.shared.common.BaseEntity;
import com.researchpms.backend.shared.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** A progress update or question that a student starts in a project. */
@Entity
@Table(name = "c3_conversation")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Conversation extends BaseEntity {

	public enum Kind {
		PROGRESS_UPDATE, QUESTION
	}

	@Column(name = "project_id", nullable = false, updatable = false)
	private UUID projectId;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "author_id", nullable = false, updatable = false)
	private User author;

	@Enumerated(EnumType.STRING)
	@Column(name = "kind", nullable = false, updatable = false, length = 20)
	private Kind kind;

	@Column(name = "subject", nullable = false, updatable = false, length = 200)
	private String subject;

	@Column(name = "body", nullable = false, updatable = false)
	private String body;

	public Conversation(UUID projectId, User author, Kind kind, String subject, String body) {
		this.projectId = projectId;
		this.author = author;
		this.kind = kind;
		this.subject = subject;
		this.body = body;
	}

}
