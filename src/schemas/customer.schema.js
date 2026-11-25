import { z } from 'zod';
import { optionalString, requiredString } from './common.schema.js';

const optionalDate = (label) =>
  z
    .string({ invalid_type_error: `${label} must be a date string` })
    .trim()
    .refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), `${label} must be YYYY-MM-DD`)
    .nullish()
    .transform((value) => {
      if (value === undefined || value === null || value === '') {
        return null;
      }
      return new Date(`${value}T00:00:00.000Z`);
    });

const optionalCustomerEmail = z
  .string({ invalid_type_error: 'email must be a string' })
  .trim()
  .max(150, 'email must not exceed 150 characters')
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

const customerBody = {
  customer_code: optionalString('customer_code', 50),
  customer_name: requiredString('customer_name', 150),
  phone: optionalString('phone', 20),
  email: optionalCustomerEmail,
  gender: optionalString('gender', 20),
  date_of_birth: optionalDate('date_of_birth'),
  anniversary_date: optionalDate('anniversary_date'),
  address: optionalString('address', 65535),
  city: optionalString('city', 100),
  state: optionalString('state', 100),
  pincode: optionalString('pincode', 12),
  gstin: optionalString('gstin', 20),
};

export const createCustomerSchema = z.object({
  body: z.object(customerBody),
});

export const updateCustomerSchema = z.object({
  body: z
    .object({
      customer_code: optionalString('customer_code', 50).optional(),
      customer_name: requiredString('customer_name', 150).optional(),
      phone: optionalString('phone', 20).optional(),
      email: optionalCustomerEmail.optional(),
      gender: optionalString('gender', 20).optional(),
      date_of_birth: optionalDate('date_of_birth').optional(),
      anniversary_date: optionalDate('anniversary_date').optional(),
      address: optionalString('address', 65535).optional(),
      city: optionalString('city', 100).optional(),
      state: optionalString('state', 100).optional(),
      pincode: optionalString('pincode', 12).optional(),
      gstin: optionalString('gstin', 20).optional(),
    })
    .refine((value) => Object.values(value).some((item) => item !== undefined), {
      message: 'At least one field is required',
    }),
});

export const listCustomerSchema = z.object({
  query: z.object({
    search: z.string().trim().max(150).optional(),
  }),
});
