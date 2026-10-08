package com.researchpms.backend.shared.security;

import com.researchpms.backend.shared.user.SystemRole;
import com.researchpms.backend.shared.user.UserRepository;
import java.util.Arrays;
import java.util.List;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.servlet.HandlerExceptionResolver;

/**
 * Stateless JWT security. Everything is protected unless it is listed as
 * public here, so a new endpoint is never public by accident. Everything
 * except the user's own details and the password change also needs a system
 * role, which a user who must still change their password does not have (see
 * {@link AuthenticatedUser#getAuthorities()}), so a new endpoint is closed to
 * such users by default as well.
 */
@Configuration
@EnableConfigurationProperties(JwtProperties.class)
public class SecurityConfig {

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http, JwtService jwtService, UserRepository userRepository,
			@Qualifier("handlerExceptionResolver") HandlerExceptionResolver exceptionResolver) throws Exception {
		http
			// No cookies or sessions are used, so there is nothing for CSRF to exploit.
			.csrf(AbstractHttpConfigurer::disable)
			.cors(Customizer.withDefaults())
			.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
			.httpBasic(AbstractHttpConfigurer::disable)
			.formLogin(AbstractHttpConfigurer::disable)
			.logout(AbstractHttpConfigurer::disable)
			.authorizeHttpRequests(requests -> requests
				.requestMatchers(HttpMethod.POST, "/api/v1/auth/register/student", "/api/v1/auth/login")
				.permitAll()
				// The only two endpoints open to a user who must still change their password.
				.requestMatchers(HttpMethod.GET, "/api/v1/auth/me")
				.authenticated()
				.requestMatchers(HttpMethod.POST, "/api/v1/auth/change-password")
				.authenticated()
				// Checked before the request body is read; AdminUserService checks again.
				.requestMatchers("/api/v1/admin/**")
				.hasRole(SystemRole.ADMIN.name())
				// Any system role, present or future; a user who must change their password has none.
				.anyRequest()
				.hasAnyRole(everySystemRole()))
			// Hand 401/403 to ApiExceptionHandler so every error has the same JSON shape.
			.exceptionHandling(handling -> handling
				.authenticationEntryPoint(
						(request, response, ex) -> exceptionResolver.resolveException(request, response, null, ex))
				.accessDeniedHandler((request, response, ex) -> exceptionResolver.resolveException(request, response,
						null, passwordChangePending() ? new PasswordChangeRequiredException() : ex)))
			.addFilterBefore(new JwtAuthenticationFilter(jwtService, userRepository),
					UsernamePasswordAuthenticationFilter.class);
		return http.build();
	}

	private static String[] everySystemRole() {
		return Arrays.stream(SystemRole.values()).map(SystemRole::name).toArray(String[]::new);
	}

	/** Lets the 403 tell the client why it was refused, so it can send the user to the password form. */
	private static boolean passwordChangePending() {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		return authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser user
				&& user.isMustChangePassword();
	}

	@Bean
	PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder();
	}

	/** Built by Spring from {@link AppUserDetailsService} and the password encoder above. */
	@Bean
	AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
		return configuration.getAuthenticationManager();
	}

	@Bean
	CorsConfigurationSource corsConfigurationSource(
			@Value("${app.security.cors.allowed-origins}") List<String> allowedOrigins) {
		CorsConfiguration configuration = new CorsConfiguration();
		configuration.setAllowedOrigins(allowedOrigins);
		configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
		configuration.setAllowedHeaders(List.of(HttpHeaders.AUTHORIZATION, HttpHeaders.CONTENT_TYPE));
		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/api/**", configuration);
		return source;
	}

}
