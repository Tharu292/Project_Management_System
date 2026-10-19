package com.researchpms.backend.shared.admin.dto;

import jakarta.validation.constraints.NotNull;

public record UpdateEnabledRequest(@NotNull Boolean enabled) {
}
