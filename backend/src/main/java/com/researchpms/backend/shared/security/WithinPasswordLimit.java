package com.researchpms.backend.shared.security;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a password supplied to prove who the caller is (login, current
 * password). It is not held to the rules for new passwords, only to the
 * length BCrypt can hash: see {@link PasswordPolicy#fitsHashLimit(String)}.
 * A missing value is left to {@code @NotBlank}.
 */
@Documented
@Constraint(validatedBy = WithinPasswordLimit.Validator.class)
@Target({ ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT })
@Retention(RetentionPolicy.RUNTIME)
public @interface WithinPasswordLimit {

	String message() default PasswordPolicy.TOO_LONG_MESSAGE;

	Class<?>[] groups() default {};

	Class<? extends Payload>[] payload() default {};

	class Validator implements ConstraintValidator<WithinPasswordLimit, String> {

		@Override
		public boolean isValid(String password, ConstraintValidatorContext context) {
			return password == null || PasswordPolicy.fitsHashLimit(password);
		}

	}

}
