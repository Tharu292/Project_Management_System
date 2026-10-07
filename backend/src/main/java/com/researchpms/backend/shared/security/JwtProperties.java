package com.researchpms.backend.shared.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Supplied through the JWT_SECRET and JWT_EXPIRATION_MS environment variables. */
@ConfigurationProperties(prefix = "app.security.jwt")
public record JwtProperties(String secret, long expirationMs) {
}
