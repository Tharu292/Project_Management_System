package com.researchpms.backend.c4.contribution;

import com.researchpms.backend.shared.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * One attempt to collect evidence from one source. A failed or partial run is
 * what makes evidence "unavailable" rather than zero.
 */
@Entity
@Table(name = "c4_evidence_sync_run")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EvidenceSyncRun extends BaseEntity {

	@Column(name = "project_id", nullable = false, updatable = false)
	private UUID projectId;

	@Enumerated(EnumType.STRING)
	@Column(name = "source", nullable = false, updatable = false, length = 30)
	private EvidenceSource source;

	@Enumerated(EnumType.STRING)
	@Column(name = "status", nullable = false, length = 20)
	private SyncStatus status = SyncStatus.RUNNING;

	@Column(name = "started_at", nullable = false, updatable = false)
	private Instant startedAt;

	@Column(name = "finished_at")
	private Instant finishedAt;

	/** A short, safe description of what went wrong. Never a token or a response body. */
	@Column(name = "detail", length = 500)
	private String detail;

	public EvidenceSyncRun(UUID projectId, EvidenceSource source, Instant startedAt) {
		this.projectId = projectId;
		this.source = source;
		this.startedAt = startedAt;
	}

	public void finish(SyncStatus status, Instant finishedAt, String detail) {
		this.status = status;
		this.finishedAt = finishedAt;
		this.detail = detail;
	}

}
