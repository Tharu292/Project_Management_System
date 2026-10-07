package com.researchpms.backend.shared.common;

import jakarta.persistence.Column;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import org.hibernate.Hibernate;

/**
 * Common base for shared entities: a UUID primary key plus creation and
 * last-update timestamps. Component entities may extend it as well.
 */
@MappedSuperclass
@Getter
public abstract class BaseEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	@Column(name = "id", nullable = false, updatable = false)
	private UUID id;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@PrePersist
	void onCreate() {
		Instant now = Instant.now();
		createdAt = now;
		updatedAt = now;
	}

	@PreUpdate
	void onUpdate() {
		updatedAt = Instant.now();
	}

	/**
	 * Two entities are equal when they are the same entity type and share a
	 * non-null id. Unsaved entities are only equal to themselves.
	 */
	@Override
	public final boolean equals(Object other) {
		if (this == other) {
			return true;
		}
		if (other == null || Hibernate.getClass(this) != Hibernate.getClass(other)) {
			return false;
		}
		return id != null && id.equals(((BaseEntity) other).getId());
	}

	/** Constant per entity type so the hash does not change when the id is assigned. */
	@Override
	public final int hashCode() {
		return Hibernate.getClass(this).hashCode();
	}

}
