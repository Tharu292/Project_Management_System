package com.researchpms.backend.shared.common;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * Turns every failure into an {@link ApiError}. Messages are fixed, client-safe
 * text: exception messages, SQL and stack traces never reach the response.
 */
@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

	/** Used for every failed login so the response never reveals whether the email exists. */
	public static final String INVALID_CREDENTIALS = "Invalid email or password.";

	@ExceptionHandler(BadCredentialsException.class)
	ResponseEntity<Object> handleBadCredentials(BadCredentialsException ex, WebRequest request) {
		return respond(HttpStatus.UNAUTHORIZED, INVALID_CREDENTIALS, Map.of(), new HttpHeaders(), request);
	}

	@ExceptionHandler(AuthenticationException.class)
	ResponseEntity<Object> handleUnauthenticated(AuthenticationException ex, WebRequest request) {
		HttpHeaders headers = new HttpHeaders();
		headers.set(HttpHeaders.WWW_AUTHENTICATE, "Bearer");
		return respond(HttpStatus.UNAUTHORIZED, "Authentication is required.", Map.of(), headers, request);
	}

	@ExceptionHandler(AccessDeniedException.class)
	ResponseEntity<Object> handleForbidden(AccessDeniedException ex, WebRequest request) {
		return respond(HttpStatus.FORBIDDEN, "You do not have permission to do this.", Map.of(), new HttpHeaders(),
				request);
	}

	@ExceptionHandler(DuplicateResourceException.class)
	ResponseEntity<Object> handleDuplicate(DuplicateResourceException ex, WebRequest request) {
		return respond(HttpStatus.CONFLICT, ex.getMessage(), Map.of(), new HttpHeaders(), request);
	}

	@ExceptionHandler(InvalidRequestException.class)
	ResponseEntity<Object> handleInvalidRequest(InvalidRequestException ex, WebRequest request) {
		return respond(HttpStatus.BAD_REQUEST, "Validation failed.", Map.of(ex.getField(), ex.getMessage()),
				new HttpHeaders(), request);
	}

	@ExceptionHandler(Exception.class)
	ResponseEntity<Object> handleUnexpected(Exception ex, WebRequest request) {
		log.error("Unhandled exception", ex);
		return respond(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred.", Map.of(), new HttpHeaders(),
				request);
	}

	@Override
	protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex,
			HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		Map<String, String> fieldErrors = new LinkedHashMap<>();
		for (FieldError error : ex.getBindingResult().getFieldErrors()) {
			fieldErrors.putIfAbsent(error.getField(), error.getDefaultMessage());
		}
		return respond(HttpStatus.BAD_REQUEST, "Validation failed.", fieldErrors, headers, request);
	}

	@Override
	protected ResponseEntity<Object> handleHttpMessageNotReadable(HttpMessageNotReadableException ex,
			HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		return respond(HttpStatus.BAD_REQUEST, "Malformed request body.", Map.of(), headers, request);
	}

	/** Every other Spring MVC error (404, 405, 415, ...) keeps its status but gets the shared body. */
	@Override
	protected ResponseEntity<Object> handleExceptionInternal(Exception ex, Object body, HttpHeaders headers,
			HttpStatusCode statusCode, WebRequest request) {
		HttpStatus status = HttpStatus.valueOf(statusCode.value());
		String message = status.is5xxServerError() ? "An unexpected error occurred." : status.getReasonPhrase() + ".";
		return respond(status, message, Map.of(), headers, request);
	}

	private ResponseEntity<Object> respond(HttpStatus status, String message, Map<String, String> fieldErrors,
			HttpHeaders headers, WebRequest request) {
		String path = request instanceof ServletWebRequest servletRequest ? servletRequest.getRequest().getRequestURI()
				: null;
		ApiError body = new ApiError(Instant.now(), status.value(), status.getReasonPhrase(), message, path,
				fieldErrors);
		return new ResponseEntity<>(body, headers, status);
	}

}
