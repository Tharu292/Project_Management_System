package com.researchpms.backend.c4.contribution;

import com.researchpms.backend.c4.access.C4AccessService;
import com.researchpms.backend.c4.access.C4Caller;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Who may see progress and contribution data. It is group-level information:
 * the active students of a project group see one another's, and so do the
 * supervisors, co-supervisors and evaluators assigned to that group. Nobody
 * sees another group's, and an administrator sees none.
 */
@Service
public class ContributionAccessService {

	private final C4AccessService access;

	public ContributionAccessService(C4AccessService access) {
		this.access = access;
	}

	/** The whole group's indicators, category scores and progress. */
	public C4Caller requireGroupView(UUID projectId) {
		C4Caller caller = access.caller(projectId);
		if (!caller.isGroupMember()) {
			throw C4AccessService.denied();
		}
		return caller;
	}

	/** One named student's indicator; the student must belong to the same group. */
	public C4Caller requireStudentView(UUID projectId, UUID studentId) {
		C4Caller caller = requireGroupView(projectId);
		access.requireStudentOfProject(projectId, studentId);
		return caller;
	}

	/** The itemised evidence behind an indicator: the assigned staff, or the student it is about. */
	public C4Caller requireEvidenceDetail(UUID projectId, UUID studentId) {
		C4Caller caller = access.caller(projectId);
		boolean own = caller.isStudentMember() && caller.userId().equals(studentId);
		if (!caller.isStaffOfProject() && !own) {
			throw C4AccessService.denied();
		}
		access.requireStudentOfProject(projectId, studentId);
		return caller;
	}

	/** Starting an evidence collection: a supervisor or co-supervisor of the project. */
	public C4Caller requireSyncPermission(UUID projectId) {
		C4Caller caller = access.caller(projectId);
		if (!caller.isSupervising()) {
			throw C4AccessService.denied();
		}
		return caller;
	}

}
