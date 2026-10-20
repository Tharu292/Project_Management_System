package com.researchpms.backend.c3.knowledge;

import com.researchpms.backend.c3.access.C3Access;
import com.researchpms.backend.c3.common.PersonSummary;
import com.researchpms.backend.c3.common.Texts;
import com.researchpms.backend.shared.common.InvalidRequestException;
import com.researchpms.backend.shared.security.CurrentUserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Module 3, project knowledge repository: the supervision team adds papers,
 * links, notes, datasets and document links; every project member can read and
 * search them. Documents are stored as links; file upload is not supported yet.
 */
@RestController
@RequestMapping("/api/v1/c3/projects/{projectId}/resources")
public class KnowledgeController {

	public record CreateResourceRequest(@NotNull(message = "Choose a type.") ResearchResource.Type type,
			@NotBlank(message = "Enter a title.") @Size(max = 300, message = "At most 300 characters.") String title,
			@Size(max = 2000, message = "At most 2,000 characters.") String url,
			@Size(max = 5000, message = "At most 5,000 characters.") String description) {
	}

	public record ResourceResponse(UUID id, UUID projectId, ResearchResource.Type type, String title, String url,
			String description, PersonSummary addedBy, Instant createdAt) {
	}

	private final ResearchResourceRepository resources;

	private final C3Access access;

	private final CurrentUserService currentUser;

	public KnowledgeController(ResearchResourceRepository resources, C3Access access, CurrentUserService currentUser) {
		this.resources = resources;
		this.access = access;
		this.currentUser = currentUser;
	}

	@GetMapping
	@Transactional(readOnly = true)
	public List<ResourceResponse> list(@PathVariable UUID projectId, @RequestParam(required = false) String q,
			@RequestParam(required = false) ResearchResource.Type type) {
		access.requireMember(projectId);
		String text = Texts.trimToNull(q);
		if (text != null && text.length() > 200) {
			throw new InvalidRequestException("q", "Search text must be at most 200 characters.");
		}
		return resources.search(projectId, type, text == null ? null : likePattern(text))
			.stream()
			.map(KnowledgeController::toResponse)
			.toList();
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	@Transactional
	public ResourceResponse create(@PathVariable UUID projectId, @Valid @RequestBody CreateResourceRequest request) {
		access.requireSupervisionTeam(projectId);
		String url = Texts.trimToNull(request.url());
		String description = Texts.trimToNull(request.description());
		if (url != null && !isWebAddress(url)) {
			throw new InvalidRequestException("url", "Enter a web address starting with http:// or https://.");
		}
		if (request.type() == ResearchResource.Type.NOTE && description == null) {
			throw new InvalidRequestException("description", "A note needs some text.");
		}
		if (request.type() != ResearchResource.Type.NOTE && url == null && description == null) {
			throw new InvalidRequestException("url", "Enter a web address or a description.");
		}
		return toResponse(resources.saveAndFlush(new ResearchResource(projectId, request.type(),
				request.title().trim(), url, description, currentUser.getCurrentUser())));
	}

	/** Lower-case, with LIKE's special characters escaped, so the search text is matched literally. */
	static String likePattern(String text) {
		String escaped = text.toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
		return "%" + escaped + "%";
	}

	private static boolean isWebAddress(String value) {
		try {
			URI uri = new URI(value);
			return ("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
					&& uri.getHost() != null;
		}
		catch (Exception ex) {
			return false;
		}
	}

	private static ResourceResponse toResponse(ResearchResource r) {
		return new ResourceResponse(r.getId(), r.getProjectId(), r.getType(), r.getTitle(), r.getUrl(),
				r.getDescription(), PersonSummary.of(r.getAddedBy()), r.getCreatedAt());
	}

}
