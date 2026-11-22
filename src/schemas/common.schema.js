import { z } from 'zod';

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const uuidString = (label) =>
  z
    .string({
      required_error: `${label} is required`,
      invalid_type_error: `${label} must be a string`,
    })
    .trim()
    .min(1, `${label} is required`)
    .regex(UUID_PATTERN, `${label} must be a valid UUID`);

export const requiredString = (label, max) =>
  z
    .string({
      required_error: `${label} is required`,
      invalid_type_error: `${label} must be a string`,
    })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must not exceed ${max} characters`);

export const optionalString = (label, max) =>
  z
    .string({ invalid_type_error: `${label} must be a string` })
    .trim()
    .max(max, `${label} must not exceed ${max} characters`)
    .nullish()
    .transform((value) => {
      if (value === undefined || value === null || value.length === 0) {
        return null;
      }
      return value;
    });

export const optionalEmail = z
  .string({ invalid_type_error: 'email must be a string' })
  .trim()
  .max(255, 'email must not exceed 255 characters')
  .nullish()
  .superRefine((value, ctx) => {
    if (value === undefined || value === null || value.length === 0) {
      return;
    }
    if (!z.string().email().safeParse(value).success) {
      ctx.addIssue({ code: 'custom', message: 'Invalid email format' });
    }
  })
  .transform((value) => {
    if (value === undefined || value === null || value.length === 0) {
      return null;
    }
    return value;
  });

export const optionalBoolean = (label) =>
  z
    .boolean({ invalid_type_error: `${label} must be a boolean` })
    .optional()
    .transform((value) => (value === undefined ? true : value));
