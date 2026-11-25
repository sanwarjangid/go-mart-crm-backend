import { z } from 'zod';
import { optionalBoolean, optionalString, requiredString } from './common.schema.js';

const positiveId = z
  .number({ invalid_type_error: 'permission_id must be a number' })
  .int()
  .positive('permission_id must be a positive integer');

export const createRoleSchema = z.object({
  body: z.object({
    name: requiredString('name', 80),
    description: optionalString('description', 255),
    is_active: optionalBoolean('is_active'),
  }),
});

export const updateRoleSchema = z.object({
  body: z
    .object({
      name: requiredString('name', 80).optional(),
      description: optionalString('description', 255).optional(),
      is_active: z.boolean({ invalid_type_error: 'is_active must be a boolean' }).optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: 'At least one field is required',
    }),
});

export const assignPermissionsSchema = z.object({
  body: z.object({
    permission_ids: z
      .array(positiveId, { invalid_type_error: 'permission_ids must be an array' })
      .refine((ids) => new Set(ids).size === ids.length, 'permission_ids must not contain duplicates'),
  }),
});
