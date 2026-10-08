package com.researchpms.backend.c4.assessment;

import java.util.concurrent.ThreadLocalRandom;
import org.springframework.stereotype.Component;

/**
 * Test-only. The real marking structure has not been approved, so tests make
 * their own throw-away entries. They carry no weight and mean nothing outside a test.
 */
@Component
public class AssessmentTestFixtures {

	private final AssessmentConfigRepository configs;

	private final AssessmentConfigEntryRepository entries;

	public AssessmentTestFixtures(AssessmentConfigRepository configs, AssessmentConfigEntryRepository entries) {
		this.configs = configs;
		this.entries = entries;
	}

	public AssessmentConfigEntry entry(AssessmentSide side) {
		int version = ThreadLocalRandom.current().nextInt(1_000_000, Integer.MAX_VALUE);
		AssessmentConfig config = configs.saveAndFlush(new AssessmentConfig(version, "Test-only structure", null));
		return entries.saveAndFlush(
				new AssessmentConfigEntry(config, "TEST-" + side.name(), "Test entry (" + side.name() + ")", side,
						null, 0));
	}

}
