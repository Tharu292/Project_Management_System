package com.researchpms.backend.shared.project;

/**
 * The role a user holds within one project. A user may hold different roles
 * in different projects, and more than one role in the same project.
 */
public enum ProjectRole {
	STUDENT,
	SUPERVISOR,
	CO_SUPERVISOR,
	EVALUATOR
}
