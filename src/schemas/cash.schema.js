import { z } from 'zod';
import { optionalString } from './common.schema.js';

const requiredId = (label) =>
  z
    .number({ required_error: `${label} is required`, invalid_type_error: `${label} must be a number` })
    .int()
    .positive(`${label} must be greater than 0`);

const money = (label) =>
  z
    .number({ required_error: `${label} is required`, invalid_type_error: `${label} must be a number` })
    .min(0, `${label} must be 0 or more`)
    .max(999999999999.99, `${label} is too large`);

const branchQuery = z
  .string()
  .regex(/^[1-9]\d*$/, 'branch_id must be a positive number')
  .optional()
  .transform((value) => (value ? Number(value) : undefined));

export const listCashSchema = z.object({
  query: z.object({
    branch_id: branchQuery,
  }),
});

export const openCashShiftSchema = z.object({
  body: z.object({
    branch_id: requiredId('branch_id'),
    counter_id: requiredId('counter_id'),
    opening_cash: money('opening_cash'),
  }),
});

export const cashMovementSchema = z.object({
  body: z.object({
    entry_type: z.enum(['cash_in', 'cash_out'], { error: 'entry_type must be cash_in or cash_out' }),
    amount: money('amount').refine((value) => value > 0, 'amount must be greater than 0'),
  }),
});

export const closeCashShiftSchema = z.object({
  body: z.object({
    closing_note: optionalString('closing_note', 255),
    denominations: z
      .array(
        z.object({
          kind: z.enum(['note', 'coin'], { error: 'kind must be note or coin' }),
          denomination: z.number({ invalid_type_error: 'denomination must be a number' }).positive(),
          quantity: z.number({ invalid_type_error: 'quantity must be a number' }).int().min(0),
        })
      )
      .optional()
      .transform((value) => value ?? []),
  }),
});
