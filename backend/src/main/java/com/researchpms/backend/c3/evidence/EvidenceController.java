package com.researchpms.backend.c3.evidence;

import com.researchpms.backend.c3.access.C3Access;
import com.researchpms.backend.c3.common.PersonSummary;
import com.researchpms.backend.c3.common.Texts;
import com.researchpms.backend.shared.common.DuplicateResourceException;
import com.researchpms.backend.shared.common.InvalidRequestException;
import com.researchpms.backend.shared.common.ResourceNotFoundException;
import com.researchpms.backend.shared.security.CurrentUserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Module 4, evidence-based assessment portfolio: students record evidence of
 * their own work, linked to project activities; supervisors and co-supervisors
 * verify it; every project member, evaluators included, can read the timeline.
 * There are no marks, grades or rubrics here: they belong to Component 4.
 */
@RestController
@RequestMapping("/api/v1/c3")
public class EvidenceController {

	public record CreateEvidenceRequest(
			@NotBlank(message = "Enter a title.") @Size(max = 200, message = "At most 200 characters.") String title,
			@Size(max = 5000, message = "At most 5,000 characters.") String description,
			@NotNull(message = "Choose the date.") LocalDate occurredOn, EvidenceItem.ActivityType activityType,
			UUID activityId) {
	}

	public record LinkedActivity(EvidenceItem.ActivityType type, UUID id, String title) {
	}

	public record EvidenceResponse(UUID id, UUID projectId, PersonSummary student, String title, String description,
			LocalDate occurredOn, LinkedActivity activity, boolean verified, PersonSummary verifiedBy,
			Instant verifiedAt, Instant createdAt) {
	}

	private final EvidenceItemRepository evidence;

	private final ActivityLookup activities;

	private final C3Access access;

	private final CurrentUserService currentUser;

	public EvidenceController(EvidenceItemRepository evidence, ActivityLookup activities, C3Access access,
			CurrentUserService currentUser) {
		this.evidence = evidence;
		this.activities = activities;
		this.access = access;
		this.currentUser = currentUser;
	}

	/** The evidence timeline of a project, newest first. */
	@GetMapping("/projects/{projectId}/evidence")
	@Transactional(readOnly = true)
	public List<EvidenceResponse> timeline(@PathVariable UUID projectId) {
		access.requireMember(projectId);
		return evidence.findByProjectIdOrderByOccurredOnDescCreatedAtDesc(projectId).stream().map(this::toResponse)
			.toList();
	}

	/** A student records evidence of their own work; nobody can record it on a student's behalf. */
	@PostMapping("/projects/{projectId}/evidence")
	@ResponseStatus(HttpStatus.CREATED)
	@Transactional
	public EvidenceResponse create(@PathVariable UUID projectId, @Valid @RequestBody CreateEvidenceRequest request) {
		access.requireStudent(projectId);
		EvidenceItem.ActivityType type = request.activityType() == null ? EvidenceItem.ActivityType.OTHER
				: request.activityType();
		if (type == EvidenceItem.ActivityType.OTHER && request.activityId() != null) {
			throw new InvalidRequestException("activityId", "Choose the type of activity this evidence is linked to.");
		}
		if (type != EvidenceItem.ActivityType.OTHER
				&& (request.activityId() == null || !activities.existsInProject(type, request.activityId(), projectId))) {
			throw new InvalidRequestException("activityId", "Choose a " + type.name().toLowerCase()
					+ " of this project.");
		}
		if (request.occurredOn().isAfter(LocalDate.now(ZoneOffset.UTC).plusDays(1))) {
			throw new InvalidRequestException("occurredOn", "Evidence cannot be dated in the future.");
		}
		EvidenceItem item = new EvidenceItem(projectId, currentUser.getCurrentUser(), request.title().trim(),
				Texts.trimToNull(request.description()), request.occurredOn(), type, request.activityId());
		return toResponse(evidence.saveAndFlush(item));
	}

	@PostMapping("/evidence/{evidenceId}/verify")
	@Transactional
	public EvidenceResponse verify(@PathVariable UUID evidenceId) {
		EvidenceItem item = evidence.findForUpdate(evidenceId)
			.orElseThrow(() -> new ResourceNotFoundException("Evidence not found."));
		access.requireSupervisor(item.getProjectId());
		if (item.isVerified()) {
			throw new DuplicateResourceException("This evidence has already been verified.");
		}
		item.verify(currentUser.getCurrentUser(), Instant.now());
		return toResponse(evidence.saveAndFlush(item));
	}

	private EvidenceResponse toResponse(EvidenceItem e) {
		LinkedActivity activity = e.getActivityType() == EvidenceItem.ActivityType.OTHER ? null
				: new LinkedActivity(e.getActivityType(), e.getActivityId(),
						activities.title(e.getActivityType(), e.getActivityId()));
		return new EvidenceResponse(e.getId(), e.getProjectId(), PersonSummary.of(e.getStudent()), e.getTitle(),
				e.getDescription(), e.getOccurredOn(), activity, e.isVerified(), PersonSummary.of(e.getVerifiedBy()),
				e.getVerifiedAt(), e.getCreatedAt());
	}

}
