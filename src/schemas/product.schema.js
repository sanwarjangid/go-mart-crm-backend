import { z } from 'zod';
import { optionalString, requiredString } from './common.schema.js';

const roundMoney = (value) => Math.round(value * 100) / 100;
const roundTax = (value) => Math.round(value * 1000) / 1000;

const money = (label) =>
  z
    .number({ invalid_type_error: `${label} must be a number` })
    .min(0, `${label} must be 0 or more`)
    .max(9999999999.99, `${label} is too large`)
    .transform(roundMoney);

const optionalMoney = (label) => money(label).optional();

const defaultMoney = (label) =>
  z
    .number({ invalid_type_error: `${label} must be a number` })
    .min(0, `${label} must be 0 or more`)
    .max(9999999999.99, `${label} is too large`)
    .optional()
    .transform((value) => (value === undefined ? 0 : roundMoney(value)));

const taxPercentage = z
  .number({ invalid_type_error: 'tax_percentage must be a number' })
  .min(0, 'tax_percentage must be 0 or more')
  .max(9999.999, 'tax_percentage is too large')
  .transform(roundTax);

const optionalId = (label) =>
  z
    .number({ invalid_type_error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .positive(`${label} must be greater than 0`)
    .nullish()
    .transform((value) => value ?? null);

const optionalUpdateId = (label) =>
  z
    .number({ invalid_type_error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .positive(`${label} must be greater than 0`)
    .nullable()
    .optional();

const requiredId = (label) =>
  z
    .number({ required_error: `${label} is required`, invalid_type_error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .positive(`${label} must be greater than 0`);

const activeFlag = z
  .boolean({ invalid_type_error: 'is_active must be a boolean' })
  .optional()
  .transform((value) => (value === undefined ? true : value));

const queryId = (label) =>
  z
    .string()
    .regex(/^[1-9]\d*$/, `${label} must be a positive number`)
    .optional();

const queryBoolean = z.enum(['true', 'false']).optional();

const hasAnyField = (value) => Object.values(value).some((item) => item !== undefined);

export const createUnitSchema = z.object({
  body: z.object({
    unit_name: requiredString('unit_name', 80),
    unit_symbol: requiredString('unit_symbol', 20),
    is_active: activeFlag,
  }),
});

export const updateUnitSchema = z.object({
  body: z
    .object({
      unit_name: requiredString('unit_name', 80).optional(),
      unit_symbol: requiredString('unit_symbol', 20).optional(),
      is_active: z.boolean({ invalid_type_error: 'is_active must be a boolean' }).optional(),
    })
    .refine(hasAnyField, { message: 'At least one field is required' }),
});

export const createTaxRateSchema = z.object({
  body: z.object({
    tax_name: requiredString('tax_name', 100),
    tax_percentage: taxPercentage,
    tax_type: requiredString('tax_type', 30),
    is_active: activeFlag,
  }),
});

export const updateTaxRateSchema = z.object({
  body: z
    .object({
      tax_name: requiredString('tax_name', 100).optional(),
      tax_percentage: taxPercentage.optional(),
      tax_type: requiredString('tax_type', 30).optional(),
      is_active: z.boolean({ invalid_type_error: 'is_active must be a boolean' }).optional(),
    })
    .refine(hasAnyField, { message: 'At least one field is required' }),
});

export const createCategorySchema = z.object({
  body: z.object({
    parent_id: optionalId('parent_id'),
    category_name: requiredString('category_name', 120),
    description: optionalString('description', 65535),
    is_active: activeFlag,
  }),
});

export const updateCategorySchema = z.object({
  body: z
    .object({
      parent_id: optionalUpdateId('parent_id'),
      category_name: requiredString('category_name', 120).optional(),
      description: optionalString('description', 65535).optional(),
      is_active: z.boolean({ invalid_type_error: 'is_active must be a boolean' }).optional(),
    })
    .refine(hasAnyField, { message: 'At least one field is required' }),
});

export const createProductSchema = z.object({
  body: z.object({
    category_id: optionalId('category_id'),
    product_name: requiredString('product_name', 180),
    product_code: optionalString('product_code', 80),
    description: optionalString('description', 65535),
    unit_id: optionalId('unit_id'),
    hsn_code: optionalString('hsn_code', 20),
    is_active: activeFlag,
  }),
});

export const updateProductSchema = z.object({
  body: z
    .object({
      category_id: optionalUpdateId('category_id'),
      product_name: requiredString('product_name', 180).optional(),
      product_code: optionalString('product_code', 80).optional(),
      description: optionalString('description', 65535).optional(),
      unit_id: optionalUpdateId('unit_id'),
      hsn_code: optionalString('hsn_code', 20).optional(),
      is_active: z.boolean({ invalid_type_error: 'is_active must be a boolean' }).optional(),
    })
    .refine(hasAnyField, { message: 'At least one field is required' }),
});

export const listProductSchema = z.object({
  query: z.object({
    search: z.string().trim().max(180).optional(),
    category_id: queryId('category_id'),
    is_active: queryBoolean,
  }),
});

export const createVariantSchema = z.object({
  body: z.object({
    variant_name: requiredString('variant_name', 150),
    sku: optionalString('sku', 100),
    barcode: optionalString('barcode', 100),
    purchase_price: defaultMoney('purchase_price'),
    selling_price: defaultMoney('selling_price'),
    mrp: defaultMoney('mrp'),
    is_active: activeFlag,
  }),
});

export const updateVariantSchema = z.object({
  body: z
    .object({
      variant_name: requiredString('variant_name', 150).optional(),
      sku: requiredString('sku', 100).optional(),
      barcode: optionalString('barcode', 100).optional(),
      purchase_price: optionalMoney('purchase_price'),
      selling_price: optionalMoney('selling_price'),
      mrp: optionalMoney('mrp'),
      is_active: z.boolean({ invalid_type_error: 'is_active must be a boolean' }).optional(),
    })
    .refine(hasAnyField, { message: 'At least one field is required' }),
});

export const listBranchPriceSchema = z.object({
  query: z.object({
    branch_id: queryId('branch_id'),
    product_variant_id: queryId('product_variant_id'),
  }),
});

export const upsertBranchPriceSchema = z.object({
  body: z.object({
    branch_id: requiredId('branch_id'),
    product_variant_id: requiredId('product_variant_id'),
    purchase_price: money('purchase_price'),
    selling_price: money('selling_price'),
    mrp: money('mrp'),
    stock_quantity: z
      .number({ invalid_type_error: 'stock_quantity must be a number' })
      .min(0, 'stock_quantity must be 0 or more')
      .max(999999999.999, 'stock_quantity is too large')
      .optional()
      .transform((value) => (value === undefined ? undefined : Math.round(value * 1000) / 1000)),
    tax_rate_id: optionalId('tax_rate_id'),
  }),
});
