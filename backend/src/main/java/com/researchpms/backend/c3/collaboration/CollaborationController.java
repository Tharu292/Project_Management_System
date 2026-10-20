package com.researchpms.backend.c3.collaboration;

import com.researchpms.backend.c3.access.C3Access;
import com.researchpms.backend.c3.common.PersonSummary;
import com.researchpms.backend.shared.common.ResourceNotFoundException;
import com.researchpms.backend.shared.security.CurrentUserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
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
 * Module 1, supervisor-student collaboration: students start progress updates
 * and questions; the supervision team replies. Only the supervision team of
 * the project may read or write; evaluators do not see these conversations.
 */
@RestController
@RequestMapping("/api/v1/c3")
public class CollaborationController {

	public record CreateConversationRequest(@NotNull(message = "Choose progress update or question.") Conversation.Kind kind,
			@NotBlank(message = "Enter a subject.") @Size(max = 200, message = "At most 200 characters.") String subject,
			@NotBlank(message = "Enter a message.") @Size(max = 5000, message = "At most 5,000 characters.") String body) {
	}

	public record ReplyRequest(
			@NotBlank(message = "Enter a reply.") @Size(max = 5000, message = "At most 5,000 characters.") String body) {
	}

	public record ReplyResponse(UUID id, PersonSummary author, String body, Instant createdAt) {
	}

	public record ConversationSummary(UUID id, UUID projectId, Conversation.Kind kind, String subject,
			PersonSummary author, Instant createdAt, int replyCount, Instant lastActivityAt) {
	}

	public record ConversationDetail(UUID id, UUID projectId, Conversation.Kind kind, String subject, String body,
			PersonSummary author, Instant createdAt, List<ReplyResponse> replies) {
	}

	private final ConversationRepository conversations;

	private final ConversationReplyRepository replies;

	private final C3Access access;

	private final CurrentUserService currentUser;

	public CollaborationController(ConversationRepository conversations, ConversationReplyRepository replies,
			C3Access access, CurrentUserService currentUser) {
		this.conversations = conversations;
		this.replies = replies;
		this.access = access;
		this.currentUser = currentUser;
	}

	@GetMapping("/projects/{projectId}/conversations")
	@Transactional(readOnly = true)
	public List<ConversationSummary> list(@PathVariable UUID projectId) {
		access.requireSupervisionTeam(projectId);
		List<Conversation> found = conversations.findByProjectIdOrderByCreatedAtDesc(projectId);
		Map<UUID, List<ConversationReply>> repliesByConversation = replies
			.findByConversationIdIn(found.stream().map(Conversation::getId).toList())
			.stream()
			.collect(Collectors.groupingBy(ConversationReply::getConversationId));
		return found.stream().map(c -> {
			List<ConversationReply> own = repliesByConversation.getOrDefault(c.getId(), List.of());
			Instant last = own.stream().map(ConversationReply::getCreatedAt).max(Comparator.naturalOrder())
				.orElse(c.getCreatedAt());
			return new ConversationSummary(c.getId(), c.getProjectId(), c.getKind(), c.getSubject(),
					PersonSummary.of(c.getAuthor()), c.getCreatedAt(), own.size(), last);
		}).toList();
	}

	@PostMapping("/projects/{projectId}/conversations")
	@ResponseStatus(HttpStatus.CREATED)
	@Transactional
	public ConversationDetail create(@PathVariable UUID projectId, @Valid @RequestBody CreateConversationRequest request) {
		access.requireStudent(projectId);
		Conversation saved = conversations.saveAndFlush(new Conversation(projectId, currentUser.getCurrentUser(),
				request.kind(), request.subject().trim(), request.body().trim()));
		return detail(saved, List.of());
	}

	@GetMapping("/conversations/{conversationId}")
	@Transactional(readOnly = true)
	public ConversationDetail get(@PathVariable UUID conversationId) {
		Conversation conversation = load(conversationId);
		access.requireSupervisionTeam(conversation.getProjectId());
		return detail(conversation, replies.findByConversationIdOrderByCreatedAtAsc(conversationId));
	}

	@PostMapping("/conversations/{conversationId}/replies")
	@ResponseStatus(HttpStatus.CREATED)
	@Transactional
	public ReplyResponse reply(@PathVariable UUID conversationId, @Valid @RequestBody ReplyRequest request) {
		Conversation conversation = load(conversationId);
		access.requireSupervisionTeam(conversation.getProjectId());
		ConversationReply saved = replies
			.saveAndFlush(new ConversationReply(conversationId, currentUser.getCurrentUser(), request.body().trim()));
		return toResponse(saved);
	}

	private Conversation load(UUID conversationId) {
		return conversations.findById(conversationId)
			.orElseThrow(() -> new ResourceNotFoundException("Conversation not found."));
	}

	private static ConversationDetail detail(Conversation c, List<ConversationReply> replyList) {
		return new ConversationDetail(c.getId(), c.getProjectId(), c.getKind(), c.getSubject(), c.getBody(),
				PersonSummary.of(c.getAuthor()), c.getCreatedAt(),
				replyList.stream().map(CollaborationController::toResponse).toList());
	}

	private static ReplyResponse toResponse(ConversationReply r) {
		return new ReplyResponse(r.getId(), PersonSummary.of(r.getAuthor()), r.getBody(), r.getCreatedAt());
	}

}
