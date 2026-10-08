package com.researchpms.backend.c4.integration;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Collaboration records, meetings, documents and collaboration feedback,
 * owned and provided by the research collaboration component. They support an
 * assessment portfolio; they are not scored. There is no implementation yet.
 */
public interface CollaborationEvidencePort {

	EvidenceResult<CollaborationRecord> recordsFor(UUID projectId, LocalDate from, LocalDate to);

	/** {@code kind} is the providing component's own category, for example a meeting or a document. */
	record CollaborationRecord(String externalId, UUID studentId, String kind, String title, Instant occurredAt,
			String sourceUrl) {
	}

}
