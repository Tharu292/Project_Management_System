package com.researchpms.backend.c4.contribution;

import com.researchpms.backend.shared.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.Locale;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A GitHub repository that belongs to a project group. A group may have several. */
@Entity
@Table(name = "c4_repository_link")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RepositoryLink extends BaseEntity {

	@Column(name = "project_id", nullable = false, updatable = false)
	private UUID projectId;

	@Column(name = "repo_owner", nullable = false, updatable = false, length = 100)
	private String repoOwner;

	@Column(name = "repo_name", nullable = false, updatable = false, length = 100)
	private String repoName;

	@Setter
	@Column(name = "active", nullable = false)
	private boolean active = true;

	@Column(name = "linked_by", nullable = false, updatable = false)
	private UUID linkedBy;

	public RepositoryLink(UUID projectId, String repoOwner, String repoName, UUID linkedBy) {
		this.projectId = projectId;
		this.repoOwner = repoOwner.trim().toLowerCase(Locale.ROOT);
		this.repoName = repoName.trim().toLowerCase(Locale.ROOT);
		this.linkedBy = linkedBy;
	}

}
