package com.researchpms.backend.shared.user;

/**
 * System-wide authority. Supervisor, co-supervisor and evaluator are not
 * system roles; they are assigned per project through project membership.
 */
public enum SystemRole {
	USER,
	ADMIN
}
