package com.researchpms.backend.c4.contribution;

/**
 * All three are kept as evidence and all three can score; how much each counts is a
 * multiplier in the scoring configuration. A pull request is counted once, in its latest state.
 */
public enum PullRequestState {

	OPEN,
	MERGED,
	CLOSED_UNMERGED

}
