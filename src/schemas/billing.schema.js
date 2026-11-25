import { z } from 'zod';
import { optionalString, requiredString } from './common.schema.js';

const money = (label, max = 999999999999.99) =>
  z
    .number({ invalid_type_error: `${label} must be a number` })
    .min(0, `${label} must be 0 or more`)
    .max(max, `${label} is too large`);

const requiredId = (label) =>
  z
    .number({ required_error: `${label} is required`, invalid_type_error: `${label} must be a number` })
    .int()
    .positive(`${label} must be greater than 0`);

const optionalId = (label) => requiredId(label).nullable().optional();

const dateTimeValue = (label) =>
  z
    .string({ required_error: `${label} is required` })
    .trim()
    .refine((value) => !Number.isNaN(Date.parse(value)), `${label} must be a valid date`)
    .transform((value) => new Date(value));

const dayQuery = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');
const queryId = z.string().regex(/^[1-9]\d*$/).optional();

const idList = (label) =>
  z
    .array(requiredId(label), { invalid_type_error: `${label} must be an array` })
    .optional()
    .transform((value) => value ?? []);

export const createPaymentModeSchema = z.object({
  body: z.object({
    mode_name: requiredString('mode_name', 60),
    is_active: z.boolean().optional().transform((value) => value ?? true),
  }),
});

export const updatePaymentModeSchema = z.object({
  body: z
    .object({
      mode_name: requiredString('mode_name', 60).optional(),
      is_active: z.boolean().optional(),
    })
    .refine((value) => Object.values(value).some((item) => item !== undefined), { message: 'At least one field is required' }),
});

const offerBody = {
  offer_name: requiredString('offer_name', 150),
  offer_code: optionalString('offer_code', 60),
  discount_type: z.enum(['percent', 'flat'], { error: 'discount_type must be percent or flat' }),
  discount_value: money('discount_value'),
  minimum_purchase: money('minimum_purchase').optional().transform((value) => value ?? 0),
  maximum_discount: money('maximum_discount').nullable().optional(),
  start_date: dateTimeValue('start_date'),
  end_date: dateTimeValue('end_date'),
  is_active: z.boolean().optional().transform((value) => value ?? true),
  branch_ids: idList('branch_ids'),
  product_variant_ids: idList('product_variant_ids'),
};

export const createOfferSchema = z.object({
  body: z.object(offerBody).refine((value) => value.end_date >= value.start_date, { message: 'end_date must be on or after start_date' }),
});

export const updateOfferSchema = z.object({
  body: z
    .object({
      offer_name: requiredString('offer_name', 150).optional(),
      offer_code: optionalString('offer_code', 60).optional(),
      discount_type: z.enum(['percent', 'flat']).optional(),
      discount_value: money('discount_value').optional(),
      minimum_purchase: money('minimum_purchase').optional(),
      maximum_discount: money('maximum_discount').nullable().optional(),
      start_date: dateTimeValue('start_date').optional(),
      end_date: dateTimeValue('end_date').optional(),
      is_active: z.boolean().optional(),
      branch_ids: z.array(requiredId('branch_ids')).optional(),
      product_variant_ids: z.array(requiredId('product_variant_ids')).optional(),
    })
    .refine((value) => Object.values(value).some((item) => item !== undefined), { message: 'At least one field is required' }),
});

export const listOfferSchema = z.object({
  query: z.object({
    branch_id: queryId,
    is_active: z.enum(['true', 'false']).optional(),
  }),
});

const invoiceItem = z.object({
  product_variant_id: requiredId('product_variant_id'),
  quantity: z.number().positive('quantity must be greater than 0').max(999999999.999),
  unit_price: money('unit_price', 9999999999.99).optional(),
  discount_type: z.enum(['percent', 'flat']).nullable().optional(),
  discount_value: money('discount_value', 9999999999.99).optional(),
  tax_rate: z.number().min(0).max(9999.999).optional(),
});

const invoicePayment = z.object({
  payment_mode_id: requiredId('payment_mode_id'),
  amount: money('amount').positive('amount must be greater than 0'),
  transaction_reference: optionalString('transaction_reference', 150),
  notes: optionalString('notes', 65535),
});

export const createInvoiceSchema = z.object({
  body: z.object({
    branch_id: requiredId('branch_id'),
    customer_id: optionalId('customer_id'),
    salesperson_id: optionalId('salesperson_id'),
    invoice_number: optionalString('invoice_number', 80),
    invoice_date: dateTimeValue('invoice_date').optional(),
    tax_mode: z.enum(['intra', 'inter']).optional().transform((value) => value ?? 'intra'),
    offer_code: optionalString('offer_code', 60),
    notes: optionalString('notes', 65535),
    items: z.array(invoiceItem).min(1, 'At least one item is required'),
    payments: z.array(invoicePayment).optional().transform((value) => value ?? []),
  }),
});

export const listInvoiceSchema = z.object({
  query: z.object({
    branch_id: queryId,
    customer_id: queryId,
    payment_status: z.enum(['unpaid', 'partial', 'paid']).optional(),
    from: dayQuery.optional(),
    to: dayQuery.optional(),
    search: z.string().trim().max(80).optional(),
  }),
});

export const addPaymentSchema = z.object({
  body: invoicePayment,
});

export const listPaymentSchema = z.object({
  query: z.object({
    branch_id: queryId,
    invoice_id: queryId,
    from: dayQuery.optional(),
    to: dayQuery.optional(),
  }),
});

export const createReturnSchema = z.object({
  body: z.object({
    items: z
      .array(
        z.object({
          invoice_item_id: requiredId('invoice_item_id'),
          quantity: z.number().positive('quantity must be greater than 0'),
          restock: z.boolean().optional(),
        }),
      )
      .min(1, 'At least one item is required'),
    refund_amount: money('refund_amount').optional(),
    refund_mode_id: optionalId('refund_mode_id'),
    notes: optionalString('notes', 65535),
  }),
});

export const listReturnSchema = z.object({
  query: z.object({
    branch_id: queryId,
    invoice_id: queryId,
    from: dayQuery.optional(),
    to: dayQuery.optional(),
  }),
});

export const monthlySalesSchema = z.object({
  query: z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM'),
    branch_id: queryId,
  }),
});

export const salespersonSalesSchema = z.object({
  query: z.object({
    from: dayQuery,
    to: dayQuery,
    branch_id: queryId,
  }),
});

export const dailySalesSchema = z.object({
  query: z.object({
    date: dayQuery,
    branch_id: queryId,
  }),
});

export const listActivitySchema = z.object({
  query: z.object({
    branch_id: queryId,
    module: z.string().trim().max(80).optional(),
  }),
});

export const registerDeviceSchema = z.object({
  body: z.object({
    branch_id: requiredId('branch_id'),
    device_uuid: z.string().trim().uuid('device_uuid must be a UUID'),
    device_name: optionalString('device_name', 150),
  }),
});

export const listDeviceSchema = z.object({
  query: z.object({ branch_id: queryId }),
});

export const syncStatusSchema = z.object({
  query: z.object({
    device_uuid: z.string().trim().uuid('device_uuid must be a UUID'),
    status: z.enum(['pending', 'failed', 'stored', 'synced']).optional(),
  }),
});

export const syncPullSchema = z.object({
  query: z.object({
    device_uuid: z.string().trim().uuid('device_uuid must be a UUID'),
    since: z.string().trim().optional(),
  }),
});

export const syncRetrySchema = z.object({
  body: z.object({
    device_uuid: z.string().trim().uuid('device_uuid must be a UUID'),
  }),
});

export const syncPushSchema = z.object({
  body: z.object({
    device_uuid: z.string().trim().uuid('device_uuid must be a UUID'),
    records: z
      .array(
        z.object({
          entity_type: requiredString('entity_type', 80),
          entity_id: requiredString('entity_id', 100),
          operation_type: z.enum(['create', 'update', 'cancel']),
          payload: z.record(z.string(), z.any()),
        }),
      )
      .min(1, 'At least one record is required'),
  }),
});
