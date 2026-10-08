package com.researchpms.backend.c4.contribution;

/**
 * One student's raw count for one metric, together with how it is known.
 * Scoring itself is not part of this class.
 */
public record MetricObservation(MetricState state, long count) {

	/** The source was read: a count of zero is a verified zero. */
	public static MetricObservation observed(long count) {
		if (count < 0) {
			throw new IllegalArgumentException("A count cannot be negative.");
		}
		return new MetricObservation(count == 0 ? MetricState.VERIFIED_ZERO : MetricState.VALUE, count);
	}

	/** The source could not be read. */
	public static MetricObservation unavailable() {
		return new MetricObservation(MetricState.UNAVAILABLE, 0);
	}

	public boolean isAvailable() {
		return state != MetricState.UNAVAILABLE;
	}

}
