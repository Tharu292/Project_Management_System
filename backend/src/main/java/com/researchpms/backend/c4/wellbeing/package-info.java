/**
 * Reflection-based wellbeing. Private by construction: the entities and
 * repositories in this package are package-private, so no other module can
 * read a reflection, a prediction, a recommendation or a warning even by
 * mistake. What leaves the package are the response types in
 * {@code wellbeing.dto}, handed out by services that check who is asking:
 *
 * <ul>
 * <li>{@link com.researchpms.backend.c4.wellbeing.PrivateWellbeingService}:
 * the owner's own data, and nobody else's;</li>
 * <li>{@link com.researchpms.backend.c4.wellbeing.GroupWellbeingSummaryService}:
 * status, score and trend of group members who opted in, for the students of
 * the same group only.</li>
 * </ul>
 *
 * Supervisors, co-supervisors, evaluators and administrators get nothing from
 * this package. The contribution and assessment modules must not depend on it.
 */
package com.researchpms.backend.c4.wellbeing;
