package com.researchpms.backend.shared.project;

import com.researchpms.backend.shared.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Minimal shared identity of a research project. Component-specific project
 * data belongs in that component's own tables, referencing this id.
 */
@Entity
@Table(name = "projects")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Project extends BaseEntity {

	@NotBlank
	@Size(max = 30)
	@Column(name = "project_code", nullable = false, unique = true, length = 30)
	private String projectCode;

	@NotBlank
	@Size(max = 255)
	@Setter
	@Column(name = "title", nullable = false, length = 255)
	private String title;

	@NotNull
	@Setter
	@Enumerated(EnumType.STRING)
	@Column(name = "status", nullable = false, length = 20)
	private ProjectStatus status = ProjectStatus.ACTIVE;

	public Project(String projectCode, String title) {
		setProjectCode(projectCode);
		this.title = title;
	}

	public void setProjectCode(String projectCode) {
		this.projectCode = projectCode == null ? null : projectCode.trim();
	}

}
