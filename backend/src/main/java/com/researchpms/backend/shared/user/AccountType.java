package com.researchpms.backend.shared.user;

/**
 * The kind of institutional account a person holds. It describes the person;
 * it is not an authorization mechanism. Project permissions come from
 * {@link com.researchpms.backend.shared.project.ProjectRole}.
 */
public enum AccountType {
	STUDENT,
	STAFF
}
