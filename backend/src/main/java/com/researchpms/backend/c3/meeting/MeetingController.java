package com.researchpms.backend.c3.meeting;

import com.researchpms.backend.c3.access.C3Access;
import com.researchpms.backend.c3.common.PersonSummary;
import com.researchpms.backend.c3.common.Texts;
import com.researchpms.backend.shared.common.DuplicateResourceException;
import com.researchpms.backend.shared.common.InvalidRequestException;
import com.researchpms.backend.shared.common.ResourceNotFoundException;
import com.researchpms.backend.shared.security.CurrentUserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Module 2, integrated meeting workspace: the supervision team schedules
 * meetings and records their minutes once they have taken place. The meeting
 * history is the project's meetings, newest first.
 */
@RestController
@RequestMapping("/api/v1/c3")
public class MeetingController {

	public record CreateMeetingRequest(
			@NotBlank(message = "Enter a title.") @Size(max = 200, message = "At most 200 characters.") String title,
			@NotNull(message = "Choose the date and time.") Instant scheduledAt,
			@Min(value = 1, message = "At least 1 minute.") @Max(value = 1440, message = "At most 1,440 minutes.") Integer durationMinutes,
			@Size(max = 500, message = "At most 500 characters.") String location,
			@Size(max = 5000, message = "At most 5,000 characters.") String agenda) {
	}

	public record MinutesRequest(
			@NotBlank(message = "Enter the minutes.") @Size(max = 10000, message = "At most 10,000 characters.") String minutes) {
	}

	public record MeetingResponse(UUID id, UUID projectId, String title, Instant scheduledAt, Integer durationMinutes,
			String location, String agenda, PersonSummary createdBy, Instant createdAt, String minutes,
			PersonSummary minutesRecordedBy, Instant minutesRecordedAt) {
	}

	private final MeetingRepository meetings;

	private final C3Access access;

	private final CurrentUserService currentUser;

	public MeetingController(MeetingRepository meetings, C3Access access, CurrentUserService currentUser) {
		this.meetings = meetings;
		this.access = access;
		this.currentUser = currentUser;
	}

	@GetMapping("/projects/{projectId}/meetings")
	@Transactional(readOnly = true)
	public List<MeetingResponse> list(@PathVariable UUID projectId) {
		access.requireSupervisionTeam(projectId);
		return meetings.findByProjectIdOrderByScheduledAtDesc(projectId).stream().map(MeetingController::toResponse)
			.toList();
	}

	@PostMapping("/projects/{projectId}/meetings")
	@ResponseStatus(HttpStatus.CREATED)
	@Transactional
	public MeetingResponse create(@PathVariable UUID projectId, @Valid @RequestBody CreateMeetingRequest request) {
		access.requireSupervisionTeam(projectId);
		Meeting meeting = new Meeting(projectId, request.title().trim(), request.scheduledAt(),
				request.durationMinutes(), Texts.trimToNull(request.location()), Texts.trimToNull(request.agenda()),
				currentUser.getCurrentUser());
		return toResponse(meetings.saveAndFlush(meeting));
	}

	/** Minutes can be recorded once, when the meeting has started. Editing them is not supported yet. */
	@PutMapping("/meetings/{meetingId}/minutes")
	@Transactional
	public MeetingResponse recordMinutes(@PathVariable UUID meetingId, @Valid @RequestBody MinutesRequest request) {
		Meeting meeting = meetings.findForUpdate(meetingId)
			.orElseThrow(() -> new ResourceNotFoundException("Meeting not found."));
		access.requireSupervisionTeam(meeting.getProjectId());
		Instant now = Instant.now();
		if (meeting.getScheduledAt().isAfter(now)) {
			throw new InvalidRequestException("minutes", "Minutes can be recorded once the meeting has started.");
		}
		if (meeting.hasMinutes()) {
			throw new DuplicateResourceException("Minutes have already been recorded for this meeting.");
		}
		meeting.recordMinutes(request.minutes().trim(), currentUser.getCurrentUser(), now);
		return toResponse(meetings.saveAndFlush(meeting));
	}

	private static MeetingResponse toResponse(Meeting m) {
		return new MeetingResponse(m.getId(), m.getProjectId(), m.getTitle(), m.getScheduledAt(),
				m.getDurationMinutes(), m.getLocation(), m.getAgenda(), PersonSummary.of(m.getCreatedBy()),
				m.getCreatedAt(), m.getMinutes(), PersonSummary.of(m.getMinutesRecordedBy()), m.getMinutesRecordedAt());
	}

}
