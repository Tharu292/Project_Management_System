package com.researchpms.backend.c3.evidence;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Component 3's answer to Component 4's {@code CollaborationEvidencePort}: the
 * supervisor-verified evidence of a project in a period. The record has the
 * same fields as the port's {@code CollaborationRecord}, so a small adapter in
 * Component 4 can use this once both components are on main. It exposes
 * evidence only; it never carries marks. Callers must have done their own
 * access check: this method has none, because it serves another component's
 * already-authorised request.
 */
@Service
public class CollaborationEvidenceQueryService {

	/** {@code kind} is this component's category: the linked activity type, for example MEETING. */
	public record CollaborationRecord(String externalId, UUID studentId, String kind, String title,
			Instant occurredAt, String sourceUrl) {
	}

	private final EvidenceItemRepository evidence;

	public CollaborationEvidenceQueryService(EvidenceItemRepository evidence) {
		this.evidence = evidence;
	}

	@Transactional(readOnly = true)
	public List<CollaborationRecord> recordsFor(UUID projectId, LocalDate from, LocalDate to) {
		return evidence.findByProjectIdAndVerifiedAtIsNotNullAndOccurredOnBetweenOrderByOccurredOnAsc(projectId, from, to)
			.stream()
			.map(e -> new CollaborationRecord("c3-evidence:" + e.getId(), e.getStudent().getId(),
					e.getActivityType().name(), e.getTitle(), e.getOccurredOn().atStartOfDay().toInstant(ZoneOffset.UTC),
					null))
			.toList();
	}

}
