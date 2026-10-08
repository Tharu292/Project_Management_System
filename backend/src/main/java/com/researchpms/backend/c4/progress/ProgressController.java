package com.researchpms.backend.c4.progress;

import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Read-only team progress. */
@RestController
@RequestMapping("/api/v1/c4/projects/{projectId}")
public class ProgressController {

	private final ProgressService progressService;

	public ProgressController(ProgressService progressService) {
		this.progressService = progressService;
	}

	@GetMapping("/progress")
	public TeamProgressResponse teamProgress(@PathVariable UUID projectId) {
		return progressService.teamProgress(projectId);
	}

}
