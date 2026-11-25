import { z } from 'zod';
import { optionalBoolean, optionalString, requiredString } from './common.schema.js';

const email = z
  .string({ required_error: 'email is required', invalid_type_error: 'email must be a string' })
  .trim()
  .min(1, 'email is required')
  .email('Invalid email format')
  .max(150, 'email must not exceed 150 characters');

const password = z
  .string({ required_error: 'password is required', invalid_type_error: 'password must be a string' })
  .min(8, 'password must be at least 8 characters')
  .max(72, 'password must not exceed 72 characters');

const positiveId = (label) =>
  z.number({ required_error: `${label} is required`, invalid_type_error: `${label} must be a number` }).int().positive(`${label} must be a positive integer`);

const employeeCode = z
  .string({ required_error: 'employee_code is required', invalid_type_error: 'employee_code must be a string' })
  .trim()
  .min(1, 'employee_code is required')
  .max(40, 'employee_code must not exceed 40 characters')
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'employee_code must use letters, numbers, or hyphens')
  .transform((value) => value.toUpperCase());

const branchIds = z
  .array(positiveId('branch_id'), {
    required_error: 'branch_ids is required',
    invalid_type_error: 'branch_ids must be an array',
  })
  .min(1, 'At least one branch is required');

export const createUserSchema = z.object({
  body: z
    .object({
      name: requiredString('name', 150),
      email,
      phone: optionalString('phone', 20),
      employee_code: employeeCode,
      password,
      role_id: positiveId('role_id'),
      branch_ids: branchIds,
      default_branch_id: positiveId('default_branch_id').optional(),
      is_active: optionalBoolean('is_active'),
    })
    .superRefine((value, ctx) => {
      if (value.default_branch_id && !value.branch_ids.includes(value.default_branch_id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['default_branch_id'],
          message: 'default_branch_id must be one of branch_ids',
        });
      }
    }),
});

export const updateUserSchema = z.object({
  body: z
    .object({
      name: requiredString('name', 150).optional(),
      email: email.optional(),
      phone: optionalString('phone', 20).optional(),
      employee_code: employeeCode.optional(),
      role_id: positiveId('role_id').optional(),
      default_branch_id: positiveId('default_branch_id').nullable().optional(),
    })
    .refine((value) => Object.values(value).some((item) => item !== undefined), {
      message: 'At least one field is required',
    }),
});

export const resetUserPasswordSchema = z.object({
  body: z.object({
    password,
  }),
});

export const updateUserStatusSchema = z.object({
  body: z.object({
    is_active: z.boolean({
      required_error: 'is_active is required',
      invalid_type_error: 'is_active must be a boolean',
    }),
  }),
});

export const assignBranchesSchema = z.object({
  body: z
    .object({
      branch_ids: branchIds,
      default_branch_id: positiveId('default_branch_id').optional(),
    })
    .superRefine((value, ctx) => {
      const uniqueIds = new Set(value.branch_ids);
      if (uniqueIds.size !== value.branch_ids.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['branch_ids'],
          message: 'branch_ids must not contain duplicates',
        });
      }
      if (value.default_branch_id && !value.branch_ids.includes(value.default_branch_id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['default_branch_id'],
          message: 'default_branch_id must be one of branch_ids',
        });
      }
    }),
});
