package com.researchpms.backend.c4.contribution;

/** Whether an evidence source could be read when a snapshot was calculated. */
public enum CoverageStatus {

	AVAILABLE,
	/** Nothing is known from this source. That is not the same as the source showing no activity. */
	UNAVAILABLE

}
