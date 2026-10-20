package com.researchpms.backend.c3.evidence;

import com.researchpms.backend.c3.collaboration.ConversationRepository;
import com.researchpms.backend.c3.knowledge.ResearchResourceRepository;
import com.researchpms.backend.c3.meeting.MeetingRepository;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Resolves the project activity an evidence item points to, and checks it belongs to the same project. */
@Component
class ActivityLookup {

	private final MeetingRepository meetings;

	private final ConversationRepository conversations;

	private final ResearchResourceRepository resources;

	ActivityLookup(MeetingRepository meetings, ConversationRepository conversations,
			ResearchResourceRepository resources) {
		this.meetings = meetings;
		this.conversations = conversations;
		this.resources = resources;
	}

	boolean existsInProject(EvidenceItem.ActivityType type, UUID activityId, UUID projectId) {
		return switch (type) {
			case MEETING -> meetings.existsByIdAndProjectId(activityId, projectId);
			case CONVERSATION -> conversations.existsByIdAndProjectId(activityId, projectId);
			case RESOURCE -> resources.existsByIdAndProjectId(activityId, projectId);
			case OTHER -> activityId == null;
		};
	}

	/** A short title of the linked activity, for the timeline; null when there is none. */
	String title(EvidenceItem.ActivityType type, UUID activityId) {
		if (activityId == null) {
			return null;
		}
		return switch (type) {
			case MEETING -> meetings.findById(activityId).map(m -> m.getTitle()).orElse(null);
			case CONVERSATION -> conversations.findById(activityId).map(c -> c.getSubject()).orElse(null);
			case RESOURCE -> resources.findById(activityId).map(r -> r.getTitle()).orElse(null);
			case OTHER -> null;
		};
	}

}
