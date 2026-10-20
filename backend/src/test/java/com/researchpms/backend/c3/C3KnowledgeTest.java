package com.researchpms.backend.c3;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;

/** Module 3: the supervision team adds resources; every member can read and search them. */
class C3KnowledgeTest extends C3TestSupport {

	private String resourcesUrl() {
		return "/api/v1/c3/projects/" + project.getId() + "/resources";
	}

	private void addSamples() throws Exception {
		postAs(student, resourcesUrl(), """
				{"type": "PAPER", "title": "Attention Is All You Need", "url": "https://arxiv.org/abs/1706.03762"}
				""").andExpect(status().isCreated()).andExpect(jsonPath("$.addedBy.id").value(student.getId().toString()));
		postAs(supervisor, resourcesUrl(), """
				{"type": "NOTE", "title": "Reading plan", "description": "Start with TRANSFORMER surveys, then 100% of the baselines."}
				""").andExpect(status().isCreated());
		postAs(coSupervisor, resourcesUrl(), """
				{"type": "DATASET", "title": "arXiv metadata", "url": "https://www.kaggle.com/datasets/Cornell-University/arxiv"}
				""").andExpect(status().isCreated());
	}

	@Test
	void addListAndSearch() throws Exception {
		addSamples();
		getAs(student, resourcesUrl()).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(3)));
		// Case-insensitive, over title, description and address.
		getAs(student, resourcesUrl() + "?q=transformer").andExpect(jsonPath("$[*].title", contains("Reading plan")));
		getAs(student, resourcesUrl() + "?q=ATTENTION").andExpect(jsonPath("$", hasSize(1)));
		getAs(student, resourcesUrl() + "?q=kaggle").andExpect(jsonPath("$[*].type", contains("DATASET")));
		getAs(student, resourcesUrl() + "?type=PAPER").andExpect(jsonPath("$", hasSize(1)));
		getAs(student, resourcesUrl() + "?q=nothing-matches").andExpect(jsonPath("$", hasSize(0)));
	}

	@Test
	void searchTreatsWildcardsLiterally() throws Exception {
		addSamples();
		// "100%" in a description matches "%" literally; "_" is not a single-character wildcard.
		getAs(student, resourcesUrl(), "q", "%").andExpect(jsonPath("$[*].title", contains("Reading plan")));
		getAs(student, resourcesUrl(), "q", "_").andExpect(jsonPath("$", hasSize(0)));
	}

	@Test
	void evaluatorsMayReadButNotAdd() throws Exception {
		addSamples();
		getAs(evaluator, resourcesUrl()).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(3)));
		expectForbidden(postAs(evaluator, resourcesUrl(), "{\"type\": \"LINK\", \"title\": \"t\", \"url\": \"https://a.b\"}"));
	}

	@Test
	void outsidersHaveNoAccess() throws Exception {
		expectForbidden(getAs(outsider, resourcesUrl()));
		expectForbidden(postAs(outsider, resourcesUrl(), "{\"type\": \"LINK\", \"title\": \"t\", \"url\": \"https://a.b\"}"));
		expectUnauthorized(getAs(null, resourcesUrl()));
	}

	@Test
	void validatesInput() throws Exception {
		expectFieldError(postAs(student, resourcesUrl(), "{\"type\": \"LINK\", \"title\": \"t\", \"url\": \"javascript:alert(1)\"}"),
				"url");
		expectFieldError(postAs(student, resourcesUrl(), "{\"type\": \"LINK\", \"title\": \"t\", \"url\": \"ftp://files.example\"}"),
				"url");
		expectFieldError(postAs(student, resourcesUrl(), "{\"type\": \"NOTE\", \"title\": \"t\"}"), "description");
		expectFieldError(postAs(student, resourcesUrl(), "{\"type\": \"PAPER\", \"title\": \"t\"}"), "url");
		expectFieldError(postAs(student, resourcesUrl(), "{\"title\": \"t\", \"url\": \"https://a.b\"}"), "type");
		expectFieldError(getAs(student, resourcesUrl() + "?q=" + "x".repeat(201)), "q");
	}

}
