package com.researchpms.backend.c4.contribution;

import com.researchpms.backend.c4.contribution.dto.MetricView;
import com.researchpms.backend.c4.contribution.dto.SnapshotView;
import com.researchpms.backend.c4.contribution.dto.SourceCoverageView;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/**
 * Reads the two JSON documents of a stored snapshot and checks them before
 * anything is shown. It reads; it never calculates, fills in or repairs.
 *
 * <p>
 * Schema version 1.
 *
 * <pre>
 * metrics:  { "schemaVersion": 1,
 *             "metrics": { "&lt;EvidenceType&gt;": { "state": "VALUE|VERIFIED_ZERO|UNAVAILABLE",
 *                                              "count": n, "normalised": 0-100, "reason": "CODE" } },
 *             "pullRequestStates": { "MERGED": n, "OPEN": n, "CLOSED_UNMERGED": n } }
 * coverage: { "schemaVersion": 1,
 *             "sources": { "&lt;EvidenceSource&gt;": { "status": "AVAILABLE|UNAVAILABLE", "reason": "CODE" } } }
 * </pre>
 *
 * Rules: all five metrics and both sources are present. VALUE has a positive
 * count, VERIFIED_ZERO a count of zero, UNAVAILABLE no count and no
 * normalised score. The pull-request state counts are present whenever
 * pull-request evidence is available and add up to its count, so each pull
 * request is counted once. A snapshot with anything unavailable is marked
 * partial.
 *
 * <p>
 * Versioning: a document says which version it was written in. Properties
 * this reader does not know are ignored, so a later version may add to a
 * document without breaking older readers. A version this reader does not
 * know is refused rather than guessed at; a new version is supported by
 * adding a case to {@link #read}.
 */
@Component
public class SnapshotJsonReader {

	public static final int CURRENT_SCHEMA_VERSION = 1;

	private static final JsonMapper JSON = JsonMapper.builder().build();

	private static final Pattern REASON_CODE = Pattern.compile("[A-Z][A-Z0-9_]{0,49}");

	private static final BigDecimal ONE_HUNDRED = BigDecimal.valueOf(100);

	record MetricsDocument(Integer schemaVersion, Map<String, MetricEntry> metrics,
			Map<String, Long> pullRequestStates) {
	}

	record MetricEntry(String state, Long count, BigDecimal normalised, String reason) {
	}

	record CoverageDocument(Integer schemaVersion, Map<String, SourceEntry> sources) {
	}

	record SourceEntry(String status, String reason) {
	}

	public SnapshotView read(ContributionSnapshot snapshot) {
		String where = "Stored contribution snapshot " + snapshot.getId();
		MetricsDocument metrics = parse(snapshot.getMetrics(), MetricsDocument.class, where + ": metrics");
		CoverageDocument coverage = parse(snapshot.getCoverage(), CoverageDocument.class, where + ": coverage");
		int version = supportedVersion(metrics.schemaVersion(), where + ": metrics");
		if (supportedVersion(coverage.schemaVersion(), where + ": coverage") != version) {
			throw new ContributionDataFormatException(where + ": metrics and coverage have different schema versions.");
		}
		return switch (version) {
			case 1 -> readVersion1(snapshot, metrics, coverage, where);
			default -> throw new ContributionDataFormatException(where + ": schema version is not supported.");
		};
	}

	private static SnapshotView readVersion1(ContributionSnapshot snapshot, MetricsDocument document,
			CoverageDocument coverageDocument, String where) {
		Map<EvidenceType, MetricView> metrics = readMetrics(document, where);
		Map<PullRequestState, Long> pullRequestStates = readPullRequestStates(document,
				metrics.get(EvidenceType.PULL_REQUEST), where);
		Map<EvidenceSource, SourceCoverageView> coverage = readCoverage(coverageDocument, where);

		List<EvidenceSource> unavailableSources = new ArrayList<>();
		coverage.forEach((source, view) -> {
			if (view.status() == CoverageStatus.UNAVAILABLE) {
				unavailableSources.add(source);
			}
		});
		boolean anythingUnavailable = !unavailableSources.isEmpty()
				|| metrics.values().stream().anyMatch(metric -> metric.state() == MetricState.UNAVAILABLE);
		if (anythingUnavailable && !snapshot.isPartial()) {
			throw new ContributionDataFormatException(
					where + ": it has unavailable evidence but is not marked as partial.");
		}
		return new SnapshotView(1, snapshot.getScoringConfig().getVersion(), snapshot.getPeriodStart(),
				snapshot.getPeriodEnd(), snapshot.getComputedAt(), snapshot.getIndicator(),
				snapshot.getDevelopmentScore(), snapshot.getTaskScore(), snapshot.getCollaborationScore(),
				snapshot.isPartial(), metrics, pullRequestStates, coverage, List.copyOf(unavailableSources));
	}

	private static Map<EvidenceType, MetricView> readMetrics(MetricsDocument document, String where) {
		if (document.metrics() == null) {
			throw new ContributionDataFormatException(where + ": the metrics are missing.");
		}
		Map<EvidenceType, MetricView> metrics = new EnumMap<>(EvidenceType.class);
		for (EvidenceType type : EvidenceType.values()) {
			MetricEntry entry = document.metrics().get(type.name());
			if (entry == null) {
				throw new ContributionDataFormatException(where + ": metric " + type + " is missing.");
			}
			metrics.put(type, readMetric(entry, where + ": metric " + type));
		}
		return metrics;
	}

	private static MetricView readMetric(MetricEntry entry, String where) {
		MetricState state = enumValue(MetricState.class, entry.state(), where + " state");
		String reason = reasonCode(entry.reason(), where);
		if (state == MetricState.UNAVAILABLE) {
			if (entry.count() != null || entry.normalised() != null) {
				throw new ContributionDataFormatException(where + ": unavailable evidence cannot carry a number.");
			}
			return new MetricView(state, null, null, reason);
		}
		if (entry.count() == null || entry.normalised() == null) {
			throw new ContributionDataFormatException(where + ": count and normalised score are required.");
		}
		boolean countFitsState = state == MetricState.VERIFIED_ZERO ? entry.count() == 0 : entry.count() > 0;
		if (!countFitsState) {
			throw new ContributionDataFormatException(where + ": the count does not fit the state " + state + ".");
		}
		if (entry.normalised().signum() < 0 || entry.normalised().compareTo(ONE_HUNDRED) > 0) {
			throw new ContributionDataFormatException(where + ": the normalised score is outside 0 to 100.");
		}
		return new MetricView(state, entry.count(), entry.normalised(), null);
	}

	private static Map<PullRequestState, Long> readPullRequestStates(MetricsDocument document, MetricView pullRequests,
			String where) {
		if (pullRequests.state() == MetricState.UNAVAILABLE) {
			if (document.pullRequestStates() != null) {
				throw new ContributionDataFormatException(
						where + ": pull-request state counts are present although the evidence is unavailable.");
			}
			return null;
		}
		if (document.pullRequestStates() == null) {
			throw new ContributionDataFormatException(where + ": the pull-request state counts are missing.");
		}
		Map<PullRequestState, Long> states = new EnumMap<>(PullRequestState.class);
		long total = 0;
		for (PullRequestState state : PullRequestState.values()) {
			Long count = document.pullRequestStates().get(state.name());
			if (count == null || count < 0) {
				throw new ContributionDataFormatException(where + ": pull-request state " + state + " has no valid count.");
			}
			states.put(state, count);
			total += count;
		}
		if (total != pullRequests.count()) {
			throw new ContributionDataFormatException(
					where + ": the pull-request state counts do not add up to the pull-request count.");
		}
		return states;
	}

	private static Map<EvidenceSource, SourceCoverageView> readCoverage(CoverageDocument document, String where) {
		if (document.sources() == null) {
			throw new ContributionDataFormatException(where + ": the coverage sources are missing.");
		}
		Map<EvidenceSource, SourceCoverageView> coverage = new EnumMap<>(EvidenceSource.class);
		for (EvidenceSource source : EvidenceSource.values()) {
			SourceEntry entry = document.sources().get(source.name());
			if (entry == null) {
				throw new ContributionDataFormatException(where + ": coverage of " + source + " is missing.");
			}
			CoverageStatus status = enumValue(CoverageStatus.class, entry.status(), where + ": coverage of " + source);
			String reason = reasonCode(entry.reason(), where + ": coverage of " + source);
			coverage.put(source,
					new SourceCoverageView(status, status == CoverageStatus.UNAVAILABLE ? reason : null));
		}
		return coverage;
	}

	private static <T> T parse(String json, Class<T> type, String where) {
		if (json == null || json.isBlank()) {
			throw new ContributionDataFormatException(where + " is empty.");
		}
		try {
			T document = JSON.readValue(json, type);
			if (document == null) {
				throw new ContributionDataFormatException(where + " is empty.");
			}
			return document;
		}
		catch (JacksonException ex) {
			// The parser's own message can quote the stored text, so it is not passed on.
			throw new ContributionDataFormatException(where + " is not valid JSON of the expected shape.");
		}
	}

	private static int supportedVersion(Integer version, String where) {
		if (version == null) {
			throw new ContributionDataFormatException(where + " has no schema version.");
		}
		if (version < 1 || version > CURRENT_SCHEMA_VERSION) {
			throw new ContributionDataFormatException(where + " has schema version " + version
					+ ", which this version cannot read (it reads up to " + CURRENT_SCHEMA_VERSION + ").");
		}
		return version;
	}

	private static <E extends Enum<E>> E enumValue(Class<E> type, String name, String where) {
		if (name != null) {
			for (E constant : type.getEnumConstants()) {
				if (constant.name().equals(name)) {
					return constant;
				}
			}
		}
		throw new ContributionDataFormatException(where + " is missing or not a known value.");
	}

	/** Reasons are short codes, never free text, so nothing unexpected can travel through them. */
	private static String reasonCode(String reason, String where) {
		if (reason != null && !REASON_CODE.matcher(reason).matches()) {
			throw new ContributionDataFormatException(where + ": the reason is not a valid code.");
		}
		return reason;
	}

}
