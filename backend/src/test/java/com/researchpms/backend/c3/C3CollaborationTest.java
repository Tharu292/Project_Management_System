package com.researchpms.backend.c3;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Module 1: students start conversations, the supervision team replies, outsiders and evaluators see nothing. */
class C3CollaborationTest extends C3TestSupport {

	private static final String QUESTION = """
			{"kind": "QUESTION", "subject": "Dataset choice", "body": "Should we use the 2024 snapshot?"}
			""";

	private String conversationsUrl() {
		return "/api/v1/c3/projects/" + project.getId() + "/conversations";
	}

	@Test
	void studentAsksSupervisorRepliesAndTheThreadIsSaved() throws Exception {
		String id = idOf(postAs(student, conversationsUrl(), QUESTION).andExpect(status().isCreated())
			.andExpect(jsonPath("$.kind").value("QUESTION"))
			.andExpect(jsonPath("$.author.id").value(student.getId().toString())));

		postAs(supervisor, "/api/v1/c3/conversations/" + id + "/replies", """
				{"body": "Yes, and record the snapshot hash."}
				""").andExpect(status().isCreated()).andExpect(jsonPath("$.author.id").value(supervisor.getId().toString()));
		postAs(student, "/api/v1/c3/conversations/" + id + "/replies", """
				{"body": "Thanks, done."}
				""").andExpect(status().isCreated());

		getAs(coSupervisor, "/api/v1/c3/conversations/" + id).andExpect(status().isOk())
			.andExpect(jsonPath("$.subject").value("Dataset choice"))
			.andExpect(jsonPath("$.replies", hasSize(2)))
			.andExpect(jsonPath("$.replies[0].body").value("Yes, and record the snapshot hash."));
		getAs(secondStudent, conversationsUrl()).andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(1)))
			.andExpect(jsonPath("$[0].replyCount").value(2));
	}

	@Test
	void onlyStudentsStartConversations() throws Exception {
		expectForbidden(postAs(supervisor, conversationsUrl(), QUESTION));
		expectForbidden(postAs(evaluator, conversationsUrl(), QUESTION));
	}

	@Test
	void evaluatorsAndOutsidersCannotReadOrReply() throws Exception {
		String id = idOf(postAs(student, conversationsUrl(), QUESTION));
		for (var user : new com.researchpms.backend.shared.user.User[] { evaluator, outsider }) {
			expectForbidden(getAs(user, conversationsUrl()));
			expectForbidden(getAs(user, "/api/v1/c3/conversations/" + id));
			expectForbidden(postAs(user, "/api/v1/c3/conversations/" + id + "/replies", "{\"body\": \"hi\"}"));
		}
		expectForbidden(postAs(outsider, conversationsUrl(), QUESTION));
	}

	@Test
	void requiresSignIn() throws Exception {
		expectUnauthorized(getAs(null, conversationsUrl()));
		expectUnauthorized(postAs(null, conversationsUrl(), QUESTION));
	}

	@Test
	void validatesInput() throws Exception {
		expectFieldError(postAs(student, conversationsUrl(), """
				{"kind": "QUESTION", "subject": " ", "body": "text"}
				"""), "subject");
		expectFieldError(postAs(student, conversationsUrl(), """
				{"subject": "s", "body": "text"}
				"""), "kind");
		expectFieldError(postAs(student, conversationsUrl(), """
				{"kind": "QUESTION", "subject": "s", "body": "%s"}
				""".formatted("x".repeat(5001))), "body");
		postAs(student, conversationsUrl(), "{\"kind\": \"COMPLAINT\", \"subject\": \"s\", \"body\": \"b\"}")
			.andExpect(status().isBadRequest());
	}

	@Test
	void unknownConversationIsNotFound() throws Exception {
		getAs(student, "/api/v1/c3/conversations/" + UUID.randomUUID()).andExpect(status().isNotFound());
	}

}
