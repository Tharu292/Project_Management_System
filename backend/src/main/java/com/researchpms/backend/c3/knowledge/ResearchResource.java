package com.researchpms.backend.c3.knowledge;

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

/** A research resource in a project's knowledge repository: a paper, link, note, dataset or document link. */
@Entity
@Table(name = "c3_resource")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ResearchResource extends BaseEntity {

	public enum Type {
		PAPER, LINK, NOTE, DATASET, DOCUMENT
	}

	@Column(name = "project_id", nullable = false, updatable = false)
	private UUID projectId;

	@Enumerated(EnumType.STRING)
	@Column(name = "resource_type", nullable = false, length = 20)
	private Type type;

	@Column(name = "title", nullable = false, length = 300)
	private String title;

	@Column(name = "url", length = 2000)
	private String url;

	@Column(name = "description")
	private String description;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "added_by", nullable = false, updatable = false)
	private User addedBy;

	public ResearchResource(UUID projectId, Type type, String title, String url, String description, User addedBy) {
		this.projectId = projectId;
		this.type = type;
		this.title = title;
		this.url = url;
		this.description = description;
		this.addedBy = addedBy;
	}

}
