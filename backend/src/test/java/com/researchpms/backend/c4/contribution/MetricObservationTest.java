package com.researchpms.backend.c4.contribution;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.EnumMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Plain unit test: no Spring context and no database. */
class MetricObservationTest {

	@Test
	void aSourceThatWasReadAndShowsNothingIsAVerifiedZero() {
		MetricObservation none = MetricObservation.observed(0);

		assertThat(none.state()).isEqualTo(MetricState.VERIFIED_ZERO);
		assertThat(none.isAvailable()).isTrue();
		assertThat(none.count()).isZero();
	}

	@Test
	void aSourceThatCouldNotBeReadIsUnavailableAndNotZero() {
		MetricObservation unknown = MetricObservation.unavailable();

		assertThat(unknown.state()).isEqualTo(MetricState.UNAVAILABLE);
		assertThat(unknown.isAvailable()).isFalse();
		assertThat(unknown).isNotEqualTo(MetricObservation.observed(0));
	}

	@Test
	void activityIsAValue() {
		assertThat(MetricObservation.observed(7)).isEqualTo(new MetricObservation(MetricState.VALUE, 7));
		assertThatThrownBy(() -> MetricObservation.observed(-1)).isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	void everyScoredEvidenceTypeBelongsToExactlyOneCategory() {
		Map<ContributionCategory, Integer> perCategory = new EnumMap<>(ContributionCategory.class);
		for (EvidenceType type : EvidenceType.values()) {
			assertThat(type.getCategory()).as(type.name()).isNotNull();
			perCategory.merge(type.getCategory(), 1, Integer::sum);
		}

		assertThat(EvidenceType.COMMIT.getCategory()).isEqualTo(ContributionCategory.DEVELOPMENT);
		assertThat(EvidenceType.PULL_REQUEST.getCategory()).isEqualTo(ContributionCategory.DEVELOPMENT);
		assertThat(EvidenceType.COMPLETED_TASK.getCategory()).isEqualTo(ContributionCategory.TASK_COMPLETION);
		assertThat(EvidenceType.ISSUE_COMMENT.getCategory()).isEqualTo(ContributionCategory.COLLABORATION);
		assertThat(EvidenceType.PULL_REQUEST_REVIEW.getCategory()).isEqualTo(ContributionCategory.COLLABORATION);
		assertThat(perCategory).containsEntry(ContributionCategory.DEVELOPMENT, 2)
			.containsEntry(ContributionCategory.TASK_COMPLETION, 1)
			.containsEntry(ContributionCategory.COLLABORATION, 2);
	}

}
