package com.researchpms.backend.shared.user;

/** The single definition of an acceptable staff email address. */
public final class StaffEmailPolicy {

	/** The only domain staff accounts may use. */
	public static final String DOMAIN = "sliit.lk";

	/** Matches the whole, already normalised address, so "x@my.sliit.lk" and "x@sliit.lk.fake.com" are refused. */
	public static final String PATTERN = "^[a-z0-9._%+-]+@sliit\\.lk$";

	public static final String MESSAGE = "Staff email must use the @" + DOMAIN + " domain.";

	private StaffEmailPolicy() {
	}

	/** Expects an address already normalised with {@link User#normalizeEmail(String)}. */
	public static boolean isStaffEmail(String normalizedEmail) {
		return normalizedEmail != null && normalizedEmail.matches(PATTERN);
	}

}
