import { z } from 'zod';
import { optionalBoolean, optionalEmail, optionalString, requiredString } from './common.schema.js';

export const createBusinessSchema = z.object({
  body: z.object({
    business_name: requiredString('business_name', 255),
    legal_name: optionalString('legal_name', 255),
    phone: optionalString('phone', 20),
    email: optionalEmail,
    GSTIN: optionalString('GSTIN', 15),
    is_active: optionalBoolean('is_active'),
  }),
});
