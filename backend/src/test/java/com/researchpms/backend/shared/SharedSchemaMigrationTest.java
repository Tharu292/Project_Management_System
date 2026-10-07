package com.researchpms.backend.shared;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.SQLException;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * The application context only starts if Flyway migrated the schema and
 * Hibernate (ddl-auto=validate) accepted it, so a passing test here proves both.
 */
@SpringBootTest
class SharedSchemaMigrationTest {

	@Autowired
	private Flyway flyway;

	@Autowired
	private DataSource dataSource;

	@Test
	void testsNeverRunAgainstTheDevelopmentDatabase() throws SQLException {
		try (Connection connection = dataSource.getConnection()) {
			assertThat(connection.getCatalog()).isNotEqualTo("research_pms");
		}
	}

	@Test
	void allMigrationsAreApplied() {
		assertThat(flyway.info().applied()).isNotEmpty();
		assertThat(flyway.info().pending()).isEmpty();
	}

}
