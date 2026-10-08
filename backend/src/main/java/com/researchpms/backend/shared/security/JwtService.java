package com.researchpms.backend.shared.security;

import com.researchpms.backend.shared.user.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.JwtParser;
import io.jsonwebtoken.Jwts;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Service;

/**
 * Issues and verifies HS256 access tokens. The only place that knows the token
 * format; other code asks {@link CurrentUserService} who the caller is.
 */
@Service
public class JwtService {

	/** HS256 needs a key of at least 256 bits. */
	static final int MIN_SECRET_BYTES = 32;

	static final String CLAIM_EMAIL = "email";

	static final String CLAIM_SYSTEM_ROLE = "systemRole";

	static final String CLAIM_SECURITY_VERSION = "securityVersion";

	/** What a verified token says about its owner. */
	public record TokenIdentity(UUID userId, int securityVersion) {
	}

	private final SecretKey key;

	private final Duration lifetime;

	private final JwtParser parser;

	public JwtService(JwtProperties properties) {
		String secret = properties.secret();
		if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < MIN_SECRET_BYTES) {
			throw new IllegalStateException(
					"JWT_SECRET must be set to a random value of at least " + MIN_SECRET_BYTES + " bytes.");
		}
		if (properties.expirationMs() <= 0) {
			throw new IllegalStateException("JWT_EXPIRATION_MS must be a positive number of milliseconds.");
		}
		this.key = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
		this.lifetime = Duration.ofMillis(properties.expirationMs());
		this.parser = Jwts.parser().verifyWith(key).build();
	}

	public String generateToken(User user) {
		Instant now = Instant.now();
		return Jwts.builder()
			.subject(user.getId().toString())
			.claim(CLAIM_EMAIL, user.getEmail())
			.claim(CLAIM_SYSTEM_ROLE, user.getSystemRole().name())
			.claim(CLAIM_SECURITY_VERSION, user.getSecurityVersion())
			.issuedAt(Date.from(now))
			.expiration(Date.from(now.plus(lifetime)))
			.signWith(key, Jwts.SIG.HS256)
			.compact();
	}

	/**
	 * The owner of a correctly signed, unexpired token; empty for anything else,
	 * including a token without a security version. The caller must still compare
	 * the version with the user's current one.
	 */
	public Optional<TokenIdentity> extractIdentity(String token) {
		try {
			Claims claims = parser.parseSignedClaims(token).getPayload();
			Integer securityVersion = claims.get(CLAIM_SECURITY_VERSION, Integer.class);
			if (claims.getSubject() == null || claims.getExpiration() == null || securityVersion == null) {
				return Optional.empty();
			}
			return Optional.of(new TokenIdentity(UUID.fromString(claims.getSubject()), securityVersion));
		}
		catch (JwtException | IllegalArgumentException ex) {
			return Optional.empty();
		}
	}

	/** The user id of a correctly signed, unexpired token; empty for anything else. */
	public Optional<UUID> extractUserId(String token) {
		return extractIdentity(token).map(TokenIdentity::userId);
	}

	public long getExpiresInSeconds() {
		return lifetime.toSeconds();
	}

}
