package com.researchpms.backend.c4.wellbeing;

import com.researchpms.backend.c4.access.C4AccessService;
import com.researchpms.backend.c4.access.C4Caller;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Who may reach wellbeing data at all: student accounts that are active
 * students of the project. Supervisors, co-supervisors, evaluators and
 * administrators are refused here, before anything is read.
 */
@Service
public class WellbeingAccessService {

	private final C4AccessService access;

	public WellbeingAccessService(C4AccessService access) {
		this.access = access;
	}

	/**
	 * For a student's own private data. Returns the caller's id, which is the
	 * only owner a private lookup may then use: no request names another student.
	 */
	public UUID requireOwner(UUID projectId) {
		return requireStudentMember(projectId).userId();
	}

	/** For the group summary: the caller must be an active student of the same group. */
	public void requireGroupSummaryView(UUID projectId) {
		requireStudentMember(projectId);
	}

	private C4Caller requireStudentMember(UUID projectId) {
		C4Caller caller = access.caller(projectId);
		if (!caller.isStudentMember()) {
			throw C4AccessService.denied();
		}
		return caller;
	}

}
