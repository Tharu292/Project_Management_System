package com.researchpms.backend.shared.auth;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.jayway.jsonpath.JsonPath;
import com.researchpms.backend.shared.user.User;
import com.researchpms.backend.shared.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

/**
 * Drives the real security filter chain through MockMvc. Each test runs in a
 * transaction that is rolled back, so no rows are left behind.
 */
@SpringBootTest
@Transactional
public abstract class AuthApiTestSupport {

	protected static final String PASSWORD = "Str0ngPassw0rd";

	@Autowired
	private WebApplicationContext context;

	@Autowired
	protected UserRepository userRepository;

	@Autowired
	protected PasswordEncoder passwordEncoder;

	protected MockMvc mockMvc;

	@BeforeEach
	void setUpMockMvc() {
		mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
	}

	/** Saves the user with {@link #PASSWORD} as its real, BCrypt-hashed password. */
	protected User saveWithPassword(User user) {
		user.setPasswordHash(passwordEncoder.encode(PASSWORD));
		return userRepository.saveAndFlush(user);
	}

	protected ResultActions postJson(String url, String json) throws Exception {
		return mockMvc.perform(post(url).contentType(MediaType.APPLICATION_JSON).content(json));
	}

	protected ResultActions login(String email, String password) throws Exception {
		return postJson("/api/v1/auth/login", """
				{"email": "%s", "password": "%s"}
				""".formatted(email, password));
	}

	protected String accessTokenFor(User user) throws Exception {
		String body = login(user.getEmail(), PASSWORD).andReturn().getResponse().getContentAsString();
		return JsonPath.read(body, "$.accessToken");
	}

}
