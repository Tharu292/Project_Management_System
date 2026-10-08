package com.researchpms.backend.c4.assessment;

public enum MarkStatus {

	/** Still being written; only its assessor can see or change it. */
	DRAFT,
	/** Locked. There is no way to change it until a correction workflow is approved. */
	SUBMITTED

}
