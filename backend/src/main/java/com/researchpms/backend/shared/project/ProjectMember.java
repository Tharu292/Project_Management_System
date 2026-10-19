package com.researchpms.backend.shared.project;

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
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One role held by one user in one project. The same user may have several
 * rows for the same project, one per role; an identical user/project/role
 * row cannot exist twice. Removing a member sets {@code active} to false.
 */
@Entity
@Table(name = "project_members", uniqueConstraints = @UniqueConstraint(name = "uq_project_members_user_project_role",
		columnNames = { "user_id", "project_id", "project_role" }))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ProjectMember extends BaseEntity {

	@NotNull
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false, updatable = false)
	private User user;

	@NotNull
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "project_id", nullable = false, updatable = false)
	private Project project;

	@NotNull
	@Enumerated(EnumType.STRING)
	@Column(name = "project_role", nullable = false, updatable = false, length = 20)
	private ProjectRole projectRole;

	@Setter
	@Column(name = "active", nullable = false)
	private boolean active = true;

	@NotNull
	@Column(name = "joined_at", nullable = false)
	private Instant joinedAt = Instant.now();

	public ProjectMember(User user, Project project, ProjectRole projectRole) {
		this.user = user;
		this.project = project;
		this.projectRole = projectRole;
	}

}
