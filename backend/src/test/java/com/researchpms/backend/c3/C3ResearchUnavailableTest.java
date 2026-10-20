package com.researchpms.backend.c3;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.net.InetAddress;
import java.net.ServerSocket;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/** Module 5 when the ML service is not running: a clear 503, never a stack trace or the service's address. */
class C3ResearchUnavailableTest extends C3TestSupport {

	@DynamicPropertySource
	static void mlServiceUrl(DynamicPropertyRegistry registry) {
		registry.add("app.c3.ml-service.url", () -> "http://127.0.0.1:" + closedPort());
	}

	/** A port that was free a moment ago and has nothing listening on it. */
	private static int closedPort() {
		try (ServerSocket socket = new ServerSocket(0, 1, InetAddress.getLoopbackAddress())) {
			return socket.getLocalPort();
		}
		catch (IOException ex) {
			throw new IllegalStateException(ex);
		}
	}

	@Test
	void unreachableServiceIsA503WithAClientSafeMessage() throws Exception {
		postAs(student, "/api/v1/c3/research/predict", "{\"title\": \"t\", \"abstract\": \"a\"}")
			.andExpect(status().isServiceUnavailable())
			.andExpect(jsonPath("$.message")
				.value("The research intelligence service is unavailable. Please try again later."))
			.andExpect(content().string(not(containsString("127.0.0.1"))))
			.andExpect(content().string(not(containsString("Exception"))));
		getAs(student, "/api/v1/c3/research/trends").andExpect(status().isServiceUnavailable());
	}

}
