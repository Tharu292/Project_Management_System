package com.researchpms.backend.c4.contribution;

public enum SyncStatus {

	RUNNING,
	SUCCESS,
	/** Some of the source was read; what was not read is unavailable, not zero. */
	PARTIAL,
	FAILED

}
