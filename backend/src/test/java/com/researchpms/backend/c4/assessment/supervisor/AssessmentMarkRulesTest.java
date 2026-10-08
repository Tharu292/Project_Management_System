package com.researchpms.backend.c4.assessment.supervisor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.researchpms.backend.c4.assessment.AssessmentConfig;
import com.researchpms.backend.c4.assessment.AssessmentConfigEntry;
import com.researchpms.backend.c4.assessment.AssessmentSide;
import com.researchpms.backend.c4.assessment.MarkStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Plain unit test of the rules every assessment record follows: no Spring context and no database. */
class AssessmentMarkRulesTest {

	private static AssessmentConfigEntry entry(AssessmentSide side) {
		return new AssessmentConfigEntry(new AssessmentConfig(1, "test", null), "TEST", "Test entry", side, null, 0);
	}

	private static SupervisorMark newMark() {
		return new SupervisorMark(UUID.randomUUID(), UUID.randomUUID(), entry(AssessmentSide.SUPERVISOR),
				UUID.randomUUID());
	}

	@Test
	void aNewRecordIsAnEmptyUnreleasedDraft() {
		SupervisorMark mark = newMark();

		assertThat(mark.getStatus()).isEqualTo(MarkStatus.DRAFT);
		assertThat(mark.getMarkPercent()).isNull();
		assertThat(mark.isReleased()).isFalse();
		assertThat(mark.getSide()).isEqualTo(AssessmentSide.SUPERVISOR);
	}

	@Test
	void aRecordCannotUseAnEntryOfTheOtherSide() {
		assertThatThrownBy(() -> new SupervisorMark(UUID.randomUUID(), UUID.randomUUID(),
				entry(AssessmentSide.EVALUATOR), UUID.randomUUID()))
			.isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	void aMarkIsAPercentageBetweenZeroAndOneHundred() {
		SupervisorMark mark = newMark();

		mark.updateDraft(new BigDecimal("0"), null);
		mark.updateDraft(new BigDecimal("100"), null);
		mark.updateDraft(null, "still thinking");
		for (String invalid : new String[] { "-0.01", "100.01", "250" }) {
			assertThatThrownBy(() -> mark.updateDraft(new BigDecimal(invalid), null)).as(invalid)
				.isInstanceOf(IllegalArgumentException.class);
		}
	}

	@Test
	void aDraftWithoutAMarkCannotBeSubmitted() {
		SupervisorMark mark = newMark();

		assertThatThrownBy(() -> mark.submit(Instant.now())).isInstanceOf(IllegalStateException.class);
		assertThat(mark.isDraft()).isTrue();
	}

	@Test
	void aSubmittedRecordIsLocked() {
		SupervisorMark mark = newMark();
		mark.updateDraft(new BigDecimal("72.50"), "good progress");
		mark.submit(Instant.now());

		assertThatThrownBy(() -> mark.updateDraft(new BigDecimal("90"), "changed my mind"))
			.isInstanceOf(IllegalStateException.class);
		assertThatThrownBy(() -> mark.submit(Instant.now())).isInstanceOf(IllegalStateException.class);
		assertThat(mark.getMarkPercent()).isEqualByComparingTo("72.50");
		assertThat(mark.getFeedback()).isEqualTo("good progress");
	}

	@Test
	void onlyASubmittedRecordCanBeReleased() {
		SupervisorMark mark = newMark();
		mark.updateDraft(new BigDecimal("60"), null);

		assertThatThrownBy(() -> mark.release(Instant.now())).isInstanceOf(IllegalStateException.class);
		assertThat(mark.isReleased()).isFalse();

		mark.submit(Instant.now());
		mark.release(Instant.now());
		assertThat(mark.isReleased()).isTrue();
	}

}
