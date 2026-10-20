package com.researchpms.backend.c3.research;

import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriBuilder;

/**
 * Calls the FastAPI ML service. Successful answers are passed on unchanged (as
 * JSON text); refusals become an {@link MlServiceException} carrying only the
 * service's client-safe message and field errors; an unreachable service is a 503.
 */
@Component
@EnableConfigurationProperties(MlServiceProperties.class)
public class MlServiceClient {

	private static final Logger log = LoggerFactory.getLogger(MlServiceClient.class);

	private final RestClient restClient;

	public MlServiceClient(MlServiceProperties properties) {
		SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
		requestFactory.setConnectTimeout(properties.connectTimeout());
		requestFactory.setReadTimeout(properties.readTimeout());
		this.restClient = RestClient.builder()
			.baseUrl(properties.url().toString())
			.requestFactory(requestFactory)
			.defaultHeader("Accept", MediaType.APPLICATION_JSON_VALUE)
			.build();
	}

	/** GET with optional query parameters; null values are left out. */
	public String get(String path, Map<String, String> query) {
		return exchange(restClient.get().uri(builder -> withQuery(builder.path(path), query).build()));
	}

	public String postJson(String path, Object body) {
		return exchange(restClient.post().uri(path).contentType(MediaType.APPLICATION_JSON).body(body));
	}

	private static UriBuilder withQuery(UriBuilder builder, Map<String, String> query) {
		query.forEach((name, value) -> {
			if (value != null) {
				builder.queryParam(name, value);
			}
		});
		return builder;
	}

	private String exchange(RestClient.RequestHeadersSpec<?> request) {
		try {
			return request.exchange((req, response) -> {
				HttpStatusCode status = response.getStatusCode();
				if (status.is2xxSuccessful()) {
					return response.bodyTo(String.class);
				}
				Map<String, Object> body = readErrorBody(response);
				throw refusal(status, body);
			});
		}
		catch (MlServiceException ex) {
			throw ex;
		}
		catch (ResourceAccessException ex) {
			log.warn("ML service unreachable: {}", ex.getMessage());
			throw MlServiceException.unavailable();
		}
	}

	@SuppressWarnings("unchecked")
	private static Map<String, Object> readErrorBody(RestClient.RequestHeadersSpec.ConvertibleClientHttpResponse response) {
		try {
			Map<String, Object> body = response.bodyTo(Map.class);
			return body == null ? Map.of() : body;
		}
		catch (RuntimeException ex) {
			return Map.of();
		}
	}

	private static MlServiceException refusal(HttpStatusCode status, Map<String, Object> body) {
		String message = body.get("message") instanceof String text && !text.isBlank() ? text : null;
		if (status.value() == 400) {
			Map<String, String> fieldErrors = new LinkedHashMap<>();
			if (body.get("fieldErrors") instanceof Map<?, ?> errors) {
				errors.forEach((field, text) -> {
					if (field instanceof String name && text instanceof String value) {
						fieldErrors.put(name, value);
					}
				});
			}
			return new MlServiceException(HttpStatus.BAD_REQUEST, message != null ? message : "The request was not valid.",
					fieldErrors);
		}
		if (status.value() == 503) {
			return new MlServiceException(HttpStatus.SERVICE_UNAVAILABLE,
					message != null ? message : MlServiceException.unavailable().getMessage(), Map.of());
		}
		log.warn("ML service answered {}", status.value());
		return new MlServiceException(HttpStatus.BAD_GATEWAY,
				"The research intelligence service returned an unexpected error.", Map.of());
	}

}
