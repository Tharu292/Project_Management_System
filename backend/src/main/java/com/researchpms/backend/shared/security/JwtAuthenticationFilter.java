package com.researchpms.backend.shared.security;

import com.researchpms.backend.shared.user.User;
import com.researchpms.backend.shared.user.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Authenticates a request from its "Authorization: Bearer" token. The user is
 * reloaded on every request, so a disabled or deleted account stops working
 * immediately even if its token has not expired, and so does a token issued
 * before the user's security version last changed (a password change, or the
 * account having been disabled). A missing or unusable token simply leaves
 * the request unauthenticated.
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

	private static final String BEARER_PREFIX = "Bearer ";

	private final JwtService jwtService;

	private final UserRepository userRepository;

	public JwtAuthenticationFilter(JwtService jwtService, UserRepository userRepository) {
		this.jwtService = jwtService;
		this.userRepository = userRepository;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
			throws ServletException, IOException {
		String header = request.getHeader(HttpHeaders.AUTHORIZATION);
		if (header != null && header.startsWith(BEARER_PREFIX)) {
			jwtService.extractIdentity(header.substring(BEARER_PREFIX.length()).trim())
				.flatMap(identity -> userRepository.findById(identity.userId())
					.filter(user -> user.getSecurityVersion() == identity.securityVersion()))
				.filter(User::isEnabled)
				.ifPresent(user -> authenticate(user, request));
		}
		filterChain.doFilter(request, response);
	}

	private void authenticate(User user, HttpServletRequest request) {
		AuthenticatedUser principal = AuthenticatedUser.from(user);
		principal.eraseCredentials();
		UsernamePasswordAuthenticationToken authentication = UsernamePasswordAuthenticationToken
			.authenticated(principal, null, principal.getAuthorities());
		authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
		SecurityContext context = SecurityContextHolder.createEmptyContext();
		context.setAuthentication(authentication);
		SecurityContextHolder.setContext(context);
	}

}
