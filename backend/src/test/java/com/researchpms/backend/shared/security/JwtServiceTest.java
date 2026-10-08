package com.researchpms.backend.shared.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.researchpms.backend.shared.SharedTestData;
import com.researchpms.backend.shared.user.SystemRole;
import com.researchpms.backend.shared.user.User;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/** Plain unit test: no Spring context and no database. */
class JwtServiceTest {

	private static final String SECRET = "unit-test-jwt-signing-key-not-a-real-secret-0123456789";

	private static final long ONE_HOUR_MS = 3_600_000;

	private final JwtService jwtService = new JwtService(new JwtProperties(SECRET, ONE_HOUR_MS));

	private static User userWithId() {
		User user = SharedTestData.student();
		ReflectionTestUtils.setField(user, "id", UUID.randomUUID());
		return user;
	}

	private static String payloadOf(String token) {
		return new String(Base64.getUrlDecoder().decode(token.split("\\.")[1]), StandardCharsets.UTF_8);
	}

	@Test
	void validTokenYieldsTheUserUuidAsSubject() {
		User user = userWithId();

		String token = jwtService.generateToken(user);

		assertThat(jwtService.extractUserId(token)).contains(user.getId());
		assertThat(payloadOf(token)).contains("\"sub\":\"" + user.getId() + "\"");
	}

	@Test
	void tokenCarriesExactlyTheApprovedClaims() {
		User user = userWithId();
		user.setSystemRole(SystemRole.ADMIN);
		long before = Instant.now().getEpochSecond();

		String payload = payloadOf(jwtService.generateToken(user));

		assertThat(payload).contains("\"email\":\"" + user.getEmail() + "\"").contains("\"systemRole\":\"ADMIN\"");
		assertThat(payload).contains("\"securityVersion\":0");
		assertThat(claimNames(payload)).containsExactlyInAnyOrder("sub", "email", "systemRole", "securityVersion",
				"iat", "exp");
		assertThat(payload).doesNotContain(user.getPasswordHash()).doesNotContainIgnoringCase("password");

		long iat = numericClaim(payload, "iat");
		long exp = numericClaim(payload, "exp");
		assertThat(iat).isBetween(before, before + 5);
		assertThat(exp - iat).isEqualTo(ONE_HOUR_MS / 1000);
		assertThat(jwtService.getExpiresInSeconds()).isEqualTo(3600);
	}

	@Test
	void tokenCarriesTheUsersSecurityVersionAtTheTimeOfIssue() {
		User user = userWithId();
		String before = jwtService.generateToken(user);

		user.changePassword(SharedTestData.PASSWORD_HASH);
		String after = jwtService.generateToken(user);

		assertThat(jwtService.extractIdentity(before))
			.contains(new JwtService.TokenIdentity(user.getId(), 0));
		assertThat(jwtService.extractIdentity(after)).contains(new JwtService.TokenIdentity(user.getId(), 1));
	}

	@Test
	void tokenWithoutASecurityVersionIsRejected() {
		String token = TestTokens.signed(SECRET, UUID.randomUUID(), Instant.now().plusSeconds(600));

		assertThat(jwtService.extractIdentity(token)).isEmpty();
		assertThat(jwtService.extractUserId(token)).isEmpty();
	}

	@Test
	void expiredTokenIsRejected() {
		assertThat(jwtService.extractUserId(TestTokens.expired(SECRET, UUID.randomUUID()))).isEmpty();
	}

	@Test
	void malformedTokensAreRejected() {
		for (String malformed : new String[] { "", " ", "not-a-jwt", "a.b.c", "a.b", "eyJhbGciOiJIUzI1NiJ9..sig" }) {
			assertThat(jwtService.extractUserId(malformed)).as(malformed).isEmpty();
		}
	}

	@Test
	void tamperedTokenIsRejected() {
		User user = userWithId();
		String token = jwtService.generateToken(user);

		String forged = TestTokens.withSubjectReplaced(token, user.getId(), UUID.randomUUID());

		assertThat(forged).isNotEqualTo(token);
		assertThat(jwtService.extractUserId(forged)).isEmpty();
	}

	@Test
	void tokenSignedWithAnotherKeyIsRejected() {
		String other = "a-completely-different-signing-key-0123456789-abcdef";

		assertThat(jwtService.extractUserId(TestTokens.withSecurityVersion(other, UUID.randomUUID(), 0))).isEmpty();
		assertThat(jwtService.extractUserId(TestTokens.withSecurityVersion(SECRET, UUID.randomUUID(), 0))).isPresent();
	}

	@Test
	void unsignedTokenIsRejected() {
		assertThat(jwtService.extractUserId(TestTokens.unsigned(UUID.randomUUID()))).isEmpty();
	}

	@Test
	void startupFailsWithoutAStrongSecretOrValidLifetime() {
		assertThatThrownBy(() -> new JwtService(new JwtProperties(null, ONE_HOUR_MS)))
			.isInstanceOf(IllegalStateException.class);
		assertThatThrownBy(() -> new JwtService(new JwtProperties("", ONE_HOUR_MS)))
			.isInstanceOf(IllegalStateException.class);
		assertThatThrownBy(() -> new JwtService(new JwtProperties("x".repeat(31), ONE_HOUR_MS)))
			.isInstanceOf(IllegalStateException.class)
			.hasMessageContaining("JWT_SECRET");
		assertThatThrownBy(() -> new JwtService(new JwtProperties(SECRET, 0)))
			.isInstanceOf(IllegalStateException.class)
			.hasMessageContaining("JWT_EXPIRATION_MS");
	}

	private static List<String> claimNames(String payload) {
		return Pattern.compile("\"(\\w+)\":").matcher(payload).results().map(match -> match.group(1)).toList();
	}

	private static long numericClaim(String payload, String name) {
		Matcher matcher = Pattern.compile("\"" + name + "\":(\\d+)").matcher(payload);
		assertThat(matcher.find()).isTrue();
		return Long.parseLong(matcher.group(1));
	}

}
