package com.researchpms.backend.c4.groups;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Group discovery for the signed-in user. It takes no parameters on purpose:
 * the user comes from the access token and from nowhere else.
 */
@RestController
@RequestMapping("/api/v1/c4/me")
public class MyGroupsController {

	private final MyGroupsService myGroupsService;

	public MyGroupsController(MyGroupsService myGroupsService) {
		this.myGroupsService = myGroupsService;
	}

	@GetMapping("/groups")
	public List<MyGroupResponse> myGroups() {
		return myGroupsService.myGroups();
	}

}
