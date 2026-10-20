package com.researchpms.backend.c3.common;

/** Small text helpers shared by the Component 3 services. */
public final class Texts {

	private Texts() {
	}

	/** Trimmed text, or null when nothing but whitespace was given. */
	public static String trimToNull(String value) {
		if (value == null) {
			return null;
		}
		String trimmed = value.trim();
		return trimmed.isEmpty() ? null : trimmed;
	}

}
