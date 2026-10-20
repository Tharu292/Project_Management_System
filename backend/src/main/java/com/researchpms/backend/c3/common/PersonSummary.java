package com.researchpms.backend.c3.common;

import com.researchpms.backend.shared.user.User;
import java.util.UUID;

/** The name of a project member, as shown next to something they wrote. Never includes contact details. */
public record PersonSummary(UUID id, String name) {

	public static PersonSummary of(User user) {
		return user == null ? null : new PersonSummary(user.getId(), user.getFirstName() + " " + user.getLastName());
	}

}
