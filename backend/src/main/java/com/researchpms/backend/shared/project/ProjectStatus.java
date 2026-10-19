package com.researchpms.backend.shared.project;

/** Lifecycle of a research project, so components can tell live projects from finished ones. */
public enum ProjectStatus {
	ACTIVE,
	COMPLETED,
	ARCHIVED
}
