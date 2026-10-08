package com.researchpms.backend.c4;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/**
 * Keeps the modules apart by reading the source. A file "depends on" a package
 * when the package name appears anywhere in it, whether in an import or
 * written out in full. Plain unit test: no Spring context and no database.
 */
class C4ModuleBoundaryTest {

	private static final Path MAIN = Path.of("src", "main", "java", "com", "researchpms", "backend");

	private static final String C4 = "com.researchpms.backend.c4.";

	private static List<String> filesMentioning(Path sourceRoot, String forbiddenPackage) throws IOException {
		assertThat(sourceRoot).as("source folder").isDirectory();
		List<String> offenders = new ArrayList<>();
		try (Stream<Path> files = Files.walk(sourceRoot)) {
			for (Path file : files.filter(path -> path.toString().endsWith(".java")).toList()) {
				if (!file.getFileName().toString().equals("package-info.java")
						&& Files.readString(file).contains(forbiddenPackage)) {
					offenders.add(MAIN.relativize(file).toString());
				}
			}
		}
		return offenders;
	}

	private static void assertNoDependency(String fromModule, String toPackage) throws IOException {
		Path from = MAIN.resolve(Path.of("c4", fromModule.split("/")));
		assertThat(filesMentioning(from, C4 + toPackage)).as("%s must not depend on %s", fromModule, toPackage)
			.isEmpty();
	}

	@Test
	void theSourceFoldersBeingCheckedExistAndHoldCode() throws IOException {
		for (String module : new String[] { "access", "integration", "groups", "contribution", "progress",
				"wellbeing", "assessment", "assessment/supervisor", "assessment/evaluator" }) {
			try (Stream<Path> files = Files.walk(MAIN.resolve(Path.of("c4", module.split("/"))))) {
				assertThat(files.filter(path -> path.toString().endsWith(".java")).count()).as(module).isPositive();
			}
		}
		// The check itself works: the wellbeing module does mention its own package.
		assertThat(filesMentioning(MAIN.resolve(Path.of("c4", "wellbeing")), C4 + "wellbeing")).isNotEmpty();
	}

	@Test
	void contributionDoesNotDependOnWellbeingOrAssessment() throws IOException {
		assertNoDependency("contribution", "wellbeing");
		assertNoDependency("contribution", "assessment");
	}

	@Test
	void assessmentDoesNotDependOnWellbeing() throws IOException {
		assertNoDependency("assessment", "wellbeing");
	}

	@Test
	void supervisorAndEvaluatorSidesDoNotDependOnEachOther() throws IOException {
		assertNoDependency("assessment/supervisor", "assessment.evaluator");
		assertNoDependency("assessment/evaluator", "assessment.supervisor");
	}

	@Test
	void wellbeingDoesNotDependOnAssessment() throws IOException {
		assertNoDependency("wellbeing", "assessment");
	}

	@Test
	void theCommonAccessAndIntegrationCodeDependsOnNoFeatureModule() throws IOException {
		for (String common : new String[] { "access", "integration" }) {
			for (String feature : new String[] { "contribution", "wellbeing", "assessment" }) {
				assertNoDependency(common, feature);
			}
		}
	}

	@Test
	void progressDoesNotDependOnWellbeingOrAssessment() throws IOException {
		assertNoDependency("progress", "wellbeing");
		assertNoDependency("progress", "assessment");
	}

	@Test
	void groupDiscoveryDependsOnNoFeatureModule() throws IOException {
		for (String feature : new String[] { "contribution", "wellbeing", "assessment" }) {
			assertNoDependency("groups", feature);
		}
	}

	@Test
	void theSharedModuleDoesNotDependOnComponentFour() throws IOException {
		assertThat(filesMentioning(MAIN.resolve("shared"), "com.researchpms.backend.c4")).isEmpty();
	}

	@Test
	void privateWellbeingTypesCannotBeSeenFromOutsideTheirPackage() throws IOException {
		for (String type : new String[] { "Reflection", "EmotionPrediction", "WellbeingScore", "Recommendation",
				"Warning", "SharingPreference", "WellbeingSummary", "ReflectionRepository",
				"EmotionPredictionRepository", "WellbeingScoreRepository", "RecommendationRepository",
				"WarningRepository", "SharingPreferenceRepository", "WellbeingSummaryRepository" }) {
			String source = Files.readString(MAIN.resolve(Path.of("c4", "wellbeing", type + ".java")));
			assertThat(source).as(type).doesNotContain("public class " + type).doesNotContain("public interface " + type);
		}
		for (String side : new String[] { "supervisor/SupervisorMark", "evaluator/EvaluatorMark",
				"supervisor/SupervisorMarkRepository", "evaluator/EvaluatorMarkRepository" }) {
			String source = Files.readString(MAIN.resolve(Path.of("c4", "assessment", side + ".java")));
			assertThat(source).as(side).doesNotContain("public class ").doesNotContain("public interface ");
		}
	}

}
