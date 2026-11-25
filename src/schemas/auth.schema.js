import { z } from 'zod';

const password = z
  .string({ required_error: 'password is required', invalid_type_error: 'password must be a string' })
  .min(8, 'password must be at least 8 characters')
  .max(72, 'password must not exceed 72 characters');

const email = z
  .string({ required_error: 'email is required', invalid_type_error: 'email must be a string' })
  .trim()
  .min(1, 'email is required')
  .email('Invalid email format')
  .max(150, 'email must not exceed 150 characters');

export const loginSchema = z.object({
  body: z.object({
    email,
    password: z
      .string({ required_error: 'password is required', invalid_type_error: 'password must be a string' })
      .min(1, 'password is required'),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    current_password: z
      .string({
        required_error: 'current_password is required',
        invalid_type_error: 'current_password must be a string',
      })
      .min(1, 'current_password is required'),
    new_password: password,
  }),
});
