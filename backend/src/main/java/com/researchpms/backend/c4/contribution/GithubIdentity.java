package com.researchpms.backend.c4.contribution;

import com.researchpms.backend.shared.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.Locale;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** The GitHub username that repository activity is attributed to. One per user. */
@Entity
@Table(name = "c4_github_identity")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class GithubIdentity extends BaseEntity {

	@Column(name = "user_id", nullable = false, updatable = false)
	private UUID userId;

	@Column(name = "github_login", nullable = false, length = 39)
	private String githubLogin;

	public GithubIdentity(UUID userId, String githubLogin) {
		this.userId = userId;
		setGithubLogin(githubLogin);
	}

	/** GitHub usernames are case-insensitive, so they are stored lower-cased. */
	public void setGithubLogin(String githubLogin) {
		this.githubLogin = githubLogin.trim().toLowerCase(Locale.ROOT);
	}

}
