package com.researchpms.backend.c4.contribution;

/**
 * Stored contribution data (a snapshot or a scoring configuration) is not in
 * a form this version can read. It is reported as a server error: nothing is
 * guessed, repaired or partly shown. The message names what is wrong and never
 * contains personal data.
 */
public class ContributionDataFormatException extends RuntimeException {

	public ContributionDataFormatException(String message) {
		super(message);
	}

	public ContributionDataFormatException(String message, Throwable cause) {
		super(message, cause);
	}

}
