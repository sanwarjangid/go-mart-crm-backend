import { z } from 'zod';
import { optionalBoolean, optionalString, requiredString, uuidString } from './common.schema.js';

const ADDRESS_MAX_BYTES = 65535;

export const createBranchSchema = z.object({
  body: z
    .object({
      business_id: uuidString('business_id'),
      branch_code: requiredString('branch_code', 50),
      branch_name: requiredString('branch_name', 255),
      address: optionalString('address', ADDRESS_MAX_BYTES),
      phone: optionalString('phone', 20),
      GSTIN: optionalString('GSTIN', 15),
      is_active: optionalBoolean('is_active'),
    })
    .superRefine((value, ctx) => {
      if (value.address && Buffer.byteLength(value.address, 'utf8') > ADDRESS_MAX_BYTES) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['address'],
          message: `address must not exceed ${ADDRESS_MAX_BYTES} bytes`,
        });
      }
    }),
});
