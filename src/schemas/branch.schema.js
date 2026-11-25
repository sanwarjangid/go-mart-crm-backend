import { z } from 'zod';
import { optionalBoolean, optionalEmail, optionalString, requiredString } from './common.schema.js';

export const createBranchSchema = z.object({
  body: z.object({
    branch_code: requiredString('branch_code', 30),
    branch_name: requiredString('branch_name', 150),
    address: optionalString('address', 65535),
    city: optionalString('city', 100),
    state: optionalString('state', 100),
    pincode: optionalString('pincode', 12),
    phone: optionalString('phone', 20),
    email: optionalEmail,
    gstin: optionalString('gstin', 20),
    is_active: optionalBoolean('is_active'),
  }),
});

export const updateBranchSchema = z.object({
  body: z
    .object({
      branch_code: requiredString('branch_code', 30).optional(),
      branch_name: requiredString('branch_name', 150).optional(),
      address: optionalString('address', 65535).optional(),
      city: optionalString('city', 100).optional(),
      state: optionalString('state', 100).optional(),
      pincode: optionalString('pincode', 12).optional(),
      phone: optionalString('phone', 20).optional(),
      email: optionalEmail.optional(),
      gstin: optionalString('gstin', 20).optional(),
      is_active: z.boolean({ invalid_type_error: 'is_active must be a boolean' }).optional(),
    })
    .refine((value) => Object.values(value).some((item) => item !== undefined), {
      message: 'At least one field is required',
    }),
});
