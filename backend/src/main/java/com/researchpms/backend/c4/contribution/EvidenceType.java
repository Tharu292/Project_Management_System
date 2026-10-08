package com.researchpms.backend.c4.contribution;

/**
 * The kinds of evidence that are scored. Each belongs to exactly one category,
 * so no event can be counted in two.
 */
public enum EvidenceType {

	COMMIT(ContributionCategory.DEVELOPMENT),
	PULL_REQUEST(ContributionCategory.DEVELOPMENT),
	COMPLETED_TASK(ContributionCategory.TASK_COMPLETION),
	ISSUE_COMMENT(ContributionCategory.COLLABORATION),
	PULL_REQUEST_REVIEW(ContributionCategory.COLLABORATION);

	private final ContributionCategory category;

	EvidenceType(ContributionCategory category) {
		this.category = category;
	}

	public ContributionCategory getCategory() {
		return category;
	}

}
