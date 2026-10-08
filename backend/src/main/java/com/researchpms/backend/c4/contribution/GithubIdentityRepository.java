package com.researchpms.backend.c4.contribution;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GithubIdentityRepository extends JpaRepository<GithubIdentity, UUID> {

	Optional<GithubIdentity> findByUserId(UUID userId);

	Optional<GithubIdentity> findByGithubLogin(String githubLogin);

}
