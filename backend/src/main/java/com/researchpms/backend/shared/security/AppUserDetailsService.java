package com.researchpms.backend.shared.security;

import com.researchpms.backend.shared.user.User;
import com.researchpms.backend.shared.user.UserRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

/** Looks users up by email for the login flow. The same lookup serves students, staff and admins. */
@Service
public class AppUserDetailsService implements UserDetailsService {

	private final UserRepository userRepository;

	public AppUserDetailsService(UserRepository userRepository) {
		this.userRepository = userRepository;
	}

	@Override
	public UserDetails loadUserByUsername(String email) {
		return userRepository.findByEmail(User.normalizeEmail(email))
			.map(AuthenticatedUser::from)
			.orElseThrow(() -> new UsernameNotFoundException("No user with that email."));
	}

}
