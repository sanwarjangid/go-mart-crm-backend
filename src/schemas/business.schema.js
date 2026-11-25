import { z } from 'zod';
import { optionalEmail, optionalString, requiredString } from './common.schema.js';

export const createBusinessSchema = z.object({
  body: z.object({
    business_name: requiredString('business_name', 180),
    legal_name: optionalString('legal_name', 180),
    registration_number: optionalString('registration_number', 80),
    gstin: optionalString('gstin', 20),
    address: optionalString('address', 65535),
    city: optionalString('city', 100),
    state: optionalString('state', 100),
    pincode: optionalString('pincode', 12),
    phone: optionalString('phone', 20),
    email: optionalEmail,
  }),
});
