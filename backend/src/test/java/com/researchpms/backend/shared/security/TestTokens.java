package com.researchpms.backend.shared.security;

import io.jsonwebtoken.Jwts;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.UUID;
import javax.crypto.spec.SecretKeySpec;

/** Hand-built tokens for proving that bad tokens are refused. */
public final class TestTokens {

	private TestTokens() {
	}

	/** Correctly signed with the given secret, but already expired. */
	public static String expired(String secret, UUID userId) {
		return signed(secret, userId, Instant.now().minusSeconds(60));
	}

	public static String signed(String secret, UUID userId, Instant expiry) {
		return Jwts.builder()
			.subject(userId.toString())
			.issuedAt(Date.from(expiry.minusSeconds(3600)))
			.expiration(Date.from(expiry))
			.signWith(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"), Jwts.SIG.HS256)
			.compact();
	}

	/** An unsigned ("alg": "none") token claiming to be the given user. */
	public static String unsigned(UUID userId) {
		return Jwts.builder()
			.subject(userId.toString())
			.expiration(Date.from(Instant.now().plusSeconds(3600)))
			.compact();
	}

	/** Keeps the original signature but swaps the subject inside the payload. */
	public static String withSubjectReplaced(String token, UUID from, UUID to) {
		String[] parts = token.split("\\.");
		String payload = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
		String forged = Base64.getUrlEncoder()
			.withoutPadding()
			.encodeToString(payload.replace(from.toString(), to.toString()).getBytes(StandardCharsets.UTF_8));
		return parts[0] + "." + forged + "." + parts[2];
	}

}
