package com.researchpms.backend.c3.research;

import java.net.URI;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** Where the Component 3 ML service (FastAPI) runs. It must only be reachable from this backend. */
@ConfigurationProperties("app.c3.ml-service")
public record MlServiceProperties(@DefaultValue("http://127.0.0.1:8000") URI url,
		@DefaultValue("2s") Duration connectTimeout, @DefaultValue("20s") Duration readTimeout) {
}
