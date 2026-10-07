package com.researchpms.backend.shared.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.researchpms.backend.shared.SharedTestData;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class ProjectPersistenceTest {

	@Autowired
	private ProjectRepository projectRepository;

	@Autowired
	private EntityManager entityManager;

	@Test
	void projectIsStoredWithUuidAndDefaultStatus() {
		Project saved = projectRepository.saveAndFlush(SharedTestData.project());
		entityManager.clear();

		Project reloaded = projectRepository.findByProjectCode(saved.getProjectCode()).orElseThrow();
		assertThat(reloaded.getId()).isEqualTo(saved.getId());
		assertThat(reloaded.getTitle()).isEqualTo("Test research project");
		assertThat(reloaded.getStatus()).isEqualTo(ProjectStatus.ACTIVE);
		assertThat(reloaded.getCreatedAt()).isNotNull();
	}

	@Test
	void statusChangeIsStored() {
		Project project = projectRepository.saveAndFlush(SharedTestData.project());
		project.setStatus(ProjectStatus.COMPLETED);
		projectRepository.saveAndFlush(project);
		entityManager.clear();

		assertThat(projectRepository.findById(project.getId()).orElseThrow().getStatus())
			.isEqualTo(ProjectStatus.COMPLETED);
	}

	@Test
	void duplicateProjectCodeIsRejected() {
		Project first = projectRepository.saveAndFlush(SharedTestData.project());
		Project second = new Project(first.getProjectCode(), "Another title");

		assertThat(projectRepository.existsByProjectCode(first.getProjectCode())).isTrue();
		assertThatThrownBy(() -> projectRepository.saveAndFlush(second))
			.isInstanceOf(DataIntegrityViolationException.class);
	}

}
