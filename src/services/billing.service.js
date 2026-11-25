import { ApiError } from '../utils/ApiError.js';
import { assertBranchAccess, branchScope, dayRange, roundMoney, shapeRecord } from '../utils/billing.js';
import {
  addPayment as addInvoicePayment,
  createSalesInvoice,
  createSalesReturn,
  getInvoiceForUser,
} from './invoice.service.js';
import {
  createActivityRecord,
  createOfferRecord,
  createPaymentModeRecord,
  findOfferByCode,
  findPaymentModeByName,
  getBranchRecord,
  getOfferRecord,
  getPaymentModeRecord,
  getVariantForSale,
  listActivityRecords,
  listInvoiceRecords,
  listOfferRecords,
  listPaymentModeRecords,
  listPaymentRecords,
  listReturnRecords,
  getReturnRecord,
  replaceOfferBranches,
  replaceOfferProducts,
  updateOfferRecord,
  updatePaymentModeRecord,
} from '../models/billing.model.js';

const uniqueIds = (ids, label) => {
  const values = ids || [];
  if (new Set(values).size !== values.length) {
    throw new ApiError(400, `${label} must not contain duplicates`);
  }
  return values;
};

export const createPaymentMode = async (payload) => {
  const existing = await findPaymentModeByName(payload.mode_name);
  if (existing) {
    throw new ApiError(409, 'Payment mode already exists');
  }
  return createPaymentModeRecord(payload);
};

export const getPaymentModes = () => listPaymentModeRecords();

export const updatePaymentMode = async (id, payload) => {
  const current = await getPaymentModeRecord(id);
  if (!current) {
    throw new ApiError(404, 'Payment mode not found');
  }
  if (payload.mode_name) {
    const existing = await findPaymentModeByName(payload.mode_name);
    if (existing && Number(existing.id) !== Number(id)) {
      throw new ApiError(409, 'Payment mode already exists');
    }
  }
  return updatePaymentModeRecord(id, payload);
};

const assertOfferLinks = async (branchIds, variantIds) => {
  for (const branchId of branchIds) {
    if (!(await getBranchRecord(branchId))) {
      throw new ApiError(400, 'Branch not found');
    }
  }
  for (const variantId of variantIds) {
    const variant = await getVariantForSale(variantId);
    if (!variant) {
      throw new ApiError(400, 'Product variant not found');
    }
  }
};

const offerData = (payload) => {
  const data = { ...payload };
  delete data.branch_ids;
  delete data.product_variant_ids;
  return data;
};

export const createOffer = async (payload, user) => {
  const branchIds = uniqueIds(payload.branch_ids, 'branch_ids');
  const variantIds = uniqueIds(payload.product_variant_ids, 'product_variant_ids');
  if (payload.discount_type === 'percent' && payload.discount_value > 100) {
    throw new ApiError(400, 'Percent discount cannot exceed 100');
  }
  if (payload.offer_code) {
    const existing = await findOfferByCode(payload.offer_code);
    if (existing) {
      throw new ApiError(409, 'Offer code already exists');
    }
  }
  await assertOfferLinks(branchIds, variantIds);
  const offer = await createOfferRecord({
    ...offerData(payload),
    offer_branches: branchIds.length ? { create: branchIds.map((branchId) => ({ branch_id: BigInt(branchId) })) } : undefined,
    offer_products: variantIds.length ? { create: variantIds.map((variantId) => ({ product_variant_id: BigInt(variantId) })) } : undefined,
  });
  await createActivityRecord({
    user_id: BigInt(user.id),
    action: 'create',
    module: 'offers',
    record_id: String(offer.id),
    description: `Created offer ${offer.offer_name}`,
  });
  return shapeRecord(offer);
};

export const getOffers = async (query, user) => {
  if (query.branch_id) {
    assertBranchAccess(user, query.branch_id);
  }
  const offers = await listOfferRecords({
    is_active: query.is_active === undefined ? undefined : query.is_active === 'true',
    ...(query.branch_id
      ? {
          OR: [{ offer_branches: { none: {} } }, { offer_branches: { some: { branch_id: BigInt(query.branch_id) } } }],
        }
      : {}),
  });
  return shapeRecord(offers);
};

export const getOffer = async (id) => {
  const offer = await getOfferRecord(id);
  if (!offer) {
    throw new ApiError(404, 'Offer not found');
  }
  return shapeRecord(offer);
};

export const updateOffer = async (id, payload) => {
  await getOffer(id);
  if (payload.discount_type === 'percent' && payload.discount_value > 100) {
    throw new ApiError(400, 'Percent discount cannot exceed 100');
  }
  if (payload.offer_code) {
    const existing = await findOfferByCode(payload.offer_code);
    if (existing && Number(existing.id) !== Number(id)) {
      throw new ApiError(409, 'Offer code already exists');
    }
  }
  if (payload.start_date && payload.end_date && payload.end_date < payload.start_date) {
    throw new ApiError(400, 'end_date must be on or after start_date');
  }
  const branchIds = payload.branch_ids ? uniqueIds(payload.branch_ids, 'branch_ids') : undefined;
  const variantIds = payload.product_variant_ids ? uniqueIds(payload.product_variant_ids, 'product_variant_ids') : undefined;
  await assertOfferLinks(branchIds || [], variantIds || []);
  const offer = await updateOfferRecord(id, offerData(payload));
  if (branchIds) {
    await replaceOfferBranches(id, branchIds);
  }
  if (variantIds) {
    await replaceOfferProducts(id, variantIds);
  }
  return getOffer(id);
};

export const getInvoices = async (query, user) => {
  const scope = branchScope(user, query.branch_id);
  const where = {
    branch_id: scope,
    customer_id: query.customer_id ? BigInt(query.customer_id) : undefined,
    payment_status: query.payment_status,
    invoice_number: query.search ? { contains: query.search } : undefined,
  };
  if (query.from || query.to) {
    where.invoice_date = {
      gte: query.from ? dayRange(query.from).start : undefined,
      lte: query.to ? dayRange(query.to).end : undefined,
    };
  }
  return shapeRecord(await listInvoiceRecords(where));
};

export const getInvoice = (id, user) => getInvoiceForUser(id, user);

export const createInvoice = (payload, user) => createSalesInvoice(payload, user);

export const addPayment = (invoiceId, payload, user) => addInvoicePayment(invoiceId, payload, user);

export const getPayments = async (query, user) => {
  const scope = branchScope(user, query.branch_id);
  const where = {
    branch_id: scope,
    invoice_id: query.invoice_id ? BigInt(query.invoice_id) : undefined,
  };
  if (query.from || query.to) {
    where.payment_date = {
      gte: query.from ? dayRange(query.from).start : undefined,
      lte: query.to ? dayRange(query.to).end : undefined,
    };
  }
  return shapeRecord(await listPaymentRecords(where));
};

const summarizeSales = (invoices, returns) => {
  const completed = invoices.filter((invoice) => invoice.invoice_status !== 'cancelled');
  const payments = new Map();
  for (const invoice of completed) {
    for (const payment of invoice.payments || []) {
      const key = payment.payment_mode.mode_name;
      payments.set(key, roundMoney((payments.get(key) || 0) + Number(payment.amount)));
    }
  }
  const sum = (rows, field) => roundMoney(rows.reduce((total, row) => total + Number(row[field]), 0));
  const grandTotal = sum(completed, 'grand_total');
  const returnTotal = roundMoney(returns.reduce((total, row) => total + Number(row.total_amount), 0));
  return {
    invoice_count: completed.length,
    cancelled_count: invoices.length - completed.length,
    return_count: returns.length,
    subtotal: sum(completed, 'subtotal'),
    discount_amount: sum(completed, 'discount_amount'),
    tax_amount: sum(completed, 'tax_amount'),
    grand_total: grandTotal,
    return_total: returnTotal,
    net_sales: roundMoney(grandTotal - returnTotal),
    paid_amount: sum(completed, 'paid_amount'),
    due_amount: sum(completed, 'due_amount'),
    payments_by_mode: [...payments.entries()].map(([mode_name, amount]) => ({ mode_name, amount })),
  };
};

export const getDailySales = async (query, user) => {
  const scope = branchScope(user, query.branch_id);
  const { start, end } = dayRange(query.date);
  const invoices = await listInvoiceRecords({
    branch_id: scope,
    invoice_date: { gte: start, lte: end },
  });
  const returns = await listReturnRecords({ branch_id: scope, return_date: { gte: start, lte: end } });
  return {
    date: query.date,
    branch_id: query.branch_id ? Number(query.branch_id) : null,
    ...summarizeSales(invoices, returns),
  };
};

export const getMonthlySales = async (query, user) => {
  const scope = branchScope(user, query.branch_id);
  const [year, month] = query.month.split('-').map(Number);
  const start = new Date(year, month - 1, 1, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59);
  const invoices = await listInvoiceRecords({ branch_id: scope, invoice_date: { gte: start, lte: end } });
  const returns = await listReturnRecords({ branch_id: scope, return_date: { gte: start, lte: end } });
  return {
    month: query.month,
    branch_id: query.branch_id ? Number(query.branch_id) : null,
    ...summarizeSales(invoices, returns),
  };
};

export const getSalespersonSales = async (query, user) => {
  const scope = branchScope(user, query.branch_id);
  const start = dayRange(query.from).start;
  const end = dayRange(query.to).end;
  const invoices = await listInvoiceRecords({
    branch_id: scope,
    invoice_date: { gte: start, lte: end },
    invoice_status: { not: 'cancelled' },
  });
  const grouped = new Map();
  for (const invoice of invoices) {
    const key = invoice.salesperson_id ? String(invoice.salesperson_id) : 'unassigned';
    const current = grouped.get(key) || {
      salesperson_id: invoice.salesperson_id ? Number(invoice.salesperson_id) : null,
      salesperson_name: invoice.salesperson?.name || 'Unassigned',
      invoice_count: 0,
      grand_total: 0,
    };
    current.invoice_count += 1;
    current.grand_total = roundMoney(current.grand_total + Number(invoice.grand_total));
    grouped.set(key, current);
  }
  return {
    from: query.from,
    to: query.to,
    branch_id: query.branch_id ? Number(query.branch_id) : null,
    salespersons: [...grouped.values()],
  };
};

export const createReturn = (invoiceId, payload, user) => createSalesReturn(invoiceId, payload, user);

export const getReturns = async (query, user) => {
  const scope = branchScope(user, query.branch_id);
  const where = {
    branch_id: scope,
    invoice_id: query.invoice_id ? BigInt(query.invoice_id) : undefined,
  };
  if (query.from || query.to) {
    where.return_date = {
      gte: query.from ? dayRange(query.from).start : undefined,
      lte: query.to ? dayRange(query.to).end : undefined,
    };
  }
  return shapeRecord(await listReturnRecords(where));
};

export const getReturn = async (id, user) => {
  const salesReturn = await getReturnRecord(id);
  if (!salesReturn) {
    throw new ApiError(404, 'Sales return not found');
  }
  assertBranchAccess(user, salesReturn.branch_id);
  return shapeRecord(salesReturn);
};

export const getActivity = async (query, user) => {
  const scope = branchScope(user, query.branch_id);
  return shapeRecord(
    await listActivityRecords({
      branch_id: scope,
      module: query.module,
    }),
  );
};
