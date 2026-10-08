package com.researchpms.backend.c4.access;

import com.researchpms.backend.shared.project.ProjectRole;
import com.researchpms.backend.shared.user.AccountType;
import com.researchpms.backend.shared.user.SystemRole;
import java.util.Set;
import java.util.UUID;

/**
 * The signed-in user in relation to one project, as Component 4 sees them.
 * A project role only counts when it fits the account: STUDENT for student
 * accounts, the staff roles for staff accounts. An administrator counts as
 * nothing here, whatever memberships the database holds, so administrative
 * rights never open project data.
 */
public record C4Caller(UUID userId, AccountType accountType, SystemRole systemRole, Set<ProjectRole> roles) {

	/** An active student of the project group. */
	public boolean isStudentMember() {
		return isOrdinaryUser() && accountType == AccountType.STUDENT && roles.contains(ProjectRole.STUDENT);
	}

	/** A supervisor or co-supervisor of the project. */
	public boolean isSupervising() {
		return isOrdinaryUser() && accountType == AccountType.STAFF
				&& (roles.contains(ProjectRole.SUPERVISOR) || roles.contains(ProjectRole.CO_SUPERVISOR));
	}

	/** An evaluator assigned to the project. */
	public boolean isEvaluator() {
		return isOrdinaryUser() && accountType == AccountType.STAFF && roles.contains(ProjectRole.EVALUATOR);
	}

	public boolean isStaffOfProject() {
		return isSupervising() || isEvaluator();
	}

	/** Anyone allowed to see the group's progress and contribution. */
	public boolean isGroupMember() {
		return isStudentMember() || isStaffOfProject();
	}

	/**
	 * Supervising and evaluating the same project is forbidden. If the data ever
	 * says so anyway, the user is kept away from both sides of the marking.
	 */
	public boolean hasAssessmentConflict() {
		return isSupervising() && isEvaluator();
	}

	private boolean isOrdinaryUser() {
		return systemRole == SystemRole.USER;
	}

}
