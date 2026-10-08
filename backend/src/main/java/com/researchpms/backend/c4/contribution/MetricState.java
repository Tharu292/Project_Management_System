package com.researchpms.backend.c4.contribution;

/** Why a metric has the value it has. The second and third must never be confused. */
public enum MetricState {

	/** The source was read and the student has activity. */
	VALUE,
	/** The source was read and the student has none: a real zero, which scores zero. */
	VERIFIED_ZERO,
	/** The source could not be read, so nothing is known. It is left out, not scored as zero. */
	UNAVAILABLE

}
