import prisma from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';

const db = (tx) => tx ?? prisma;

const invoiceInclude = {
  customer: {
    select: { id: true, customer_code: true, customer_name: true, phone: true, gstin: true },
  },
  branch: {
    select: {
      id: true,
      branch_code: true,
      branch_name: true,
      gstin: true,
      address: true,
      city: true,
      state: true,
      phone: true,
    },
  },
  items: { orderBy: { id: 'asc' } },
  salesperson: { select: { id: true, name: true } },
  payments: {
    include: { payment_mode: { select: { id: true, mode_name: true } } },
    orderBy: { id: 'asc' },
  },
};

const returnInclude = {
  items: true,
  refund_mode: { select: { id: true, mode_name: true } },
  invoice: { select: { id: true, invoice_number: true, paid_amount: true } },
};

export const createPaymentModeRecord = (data) => prisma.paymentMode.create({ data });
export const listPaymentModeRecords = () => prisma.paymentMode.findMany({ orderBy: { mode_name: 'asc' } });
export const getPaymentModeRecord = (id) => prisma.paymentMode.findUnique({ where: { id: BigInt(id) } });
export const findPaymentModeByName = (modeName) => prisma.paymentMode.findUnique({ where: { mode_name: modeName } });
export const updatePaymentModeRecord = (id, data) => prisma.paymentMode.update({ where: { id: BigInt(id) }, data });

const offerInclude = {
  offer_branches: { select: { id: true, branch_id: true } },
  offer_products: { select: { id: true, product_variant_id: true } },
};

export const createOfferRecord = (data, tx) => db(tx).offer.create({ data, include: offerInclude });
export const listOfferRecords = (where) => prisma.offer.findMany({ where, include: offerInclude, orderBy: { created_at: 'desc' } });
export const getOfferRecord = (id) => prisma.offer.findUnique({ where: { id: BigInt(id) }, include: offerInclude });
export const findOfferByCode = (offerCode, tx) => db(tx).offer.findUnique({ where: { offer_code: offerCode }, include: offerInclude });
export const updateOfferRecord = (id, data) => prisma.offer.update({ where: { id: BigInt(id) }, data, include: offerInclude });
export const replaceOfferBranches = (offerId, branchIds) =>
  prisma.$transaction([
    prisma.offerBranch.deleteMany({ where: { offer_id: BigInt(offerId) } }),
    ...(branchIds.length
      ? [prisma.offerBranch.createMany({ data: branchIds.map((branchId) => ({ offer_id: BigInt(offerId), branch_id: BigInt(branchId) })) })]
      : []),
  ]);
export const replaceOfferProducts = (offerId, variantIds) =>
  prisma.$transaction([
    prisma.offerProduct.deleteMany({ where: { offer_id: BigInt(offerId) } }),
    ...(variantIds.length
      ? [prisma.offerProduct.createMany({ data: variantIds.map((variantId) => ({ offer_id: BigInt(offerId), product_variant_id: BigInt(variantId) })) })]
      : []),
  ]);

export const getBranchRecord = (id, tx) => db(tx).branch.findUnique({ where: { id: BigInt(id) } });
export const getCustomerRecord = (id, tx) => db(tx).customer.findUnique({ where: { id: BigInt(id) } });
export const getUserRecord = (id, tx) => db(tx).user.findUnique({ where: { id: BigInt(id) }, select: { id: true, is_active: true } });
const stockKey = (branchId, variantId) => ({
  branch_id_product_variant_id: {
    branch_id: BigInt(branchId),
    product_variant_id: BigInt(variantId),
  },
});

export const changeBranchStock = async (branchId, variantId, delta, tx) => {
  const row = await db(tx).branchProductPrice.findUnique({
    where: stockKey(branchId, variantId),
    include: {
      product_variant: { select: { product: { select: { product_name: true } } } },
    },
  });
  if (!row) {
    throw new ApiError(400, 'Assign this product to the branch before selling it');
  }
  const next = Math.round((Number(row.stock_quantity) + Number(delta)) * 1000) / 1000;
  if (next < -0.0001) {
    const name = row.product_variant?.product?.product_name || 'This product';
    throw new ApiError(400, `${name} does not have enough stock`);
  }
  await db(tx).branchProductPrice.update({
    where: { id: row.id },
    data: { stock_quantity: next },
  });
};

export const getVariantForSale = (id, tx) =>
  db(tx).productVariant.findUnique({
    where: { id: BigInt(id) },
    include: {
      product: { select: { id: true, product_name: true, hsn_code: true, is_active: true } },
      branch_prices: { include: { tax_rate: true } },
    },
  });

export const findInvoiceByNumber = (branchId, invoiceNumber, tx) =>
  db(tx).salesInvoice.findUnique({
    where: { branch_id_invoice_number: { branch_id: BigInt(branchId), invoice_number: invoiceNumber } },
    include: invoiceInclude,
  });

export const createInvoiceRecord = (data, tx) => db(tx).salesInvoice.create({ data, include: invoiceInclude });
export const getInvoiceRecord = (id, tx) => db(tx).salesInvoice.findUnique({ where: { id: BigInt(id) }, include: invoiceInclude });
export const listInvoiceRecords = (where) => prisma.salesInvoice.findMany({ where, include: invoiceInclude, orderBy: { invoice_date: 'desc' } });
export const updateInvoiceRecord = (id, data, tx) => db(tx).salesInvoice.update({ where: { id: BigInt(id) }, data, include: invoiceInclude });

export const createPaymentRecord = (data, tx) => db(tx).payment.create({ data, include: { payment_mode: true } });
export const listPaymentRecords = (where) =>
  prisma.payment.findMany({
    where,
    include: { payment_mode: { select: { id: true, mode_name: true } }, invoice: { select: { id: true, invoice_number: true } } },
    orderBy: { payment_date: 'desc' },
  });

export const createActivityRecord = (data, tx) => db(tx).activityLog.create({ data });
export const listActivityRecords = (where) => prisma.activityLog.findMany({ where, orderBy: { created_at: 'desc' }, take: 200 });

export const upsertEntityVersion = (entityType, entityId, deviceId, tx) =>
  db(tx).syncEntityVersion.upsert({
    where: { entity_type_entity_id: { entity_type: entityType, entity_id: String(entityId) } },
    create: { entity_type: entityType, entity_id: String(entityId), version: 1, device_id: deviceId ? BigInt(deviceId) : null },
    update: { version: { increment: 1 }, device_id: deviceId ? BigInt(deviceId) : undefined },
  });

export const nextInvoiceNumber = async (tx, branch, invoiceDate) => {
  const year = invoiceDate.getMonth() >= 3 ? invoiceDate.getFullYear() : invoiceDate.getFullYear() - 1;
  const financialYear = `${year}-${String(year + 1).slice(-2)}`;
  const prefix = branch.branch_code.slice(0, 20);
  await tx.$executeRawUnsafe(
    'INSERT INTO invoice_sequences (branch_id, financial_year, prefix, last_number) VALUES (?, ?, ?, 0) ON DUPLICATE KEY UPDATE prefix = prefix',
    branch.id,
    financialYear,
    prefix,
  );
  const rows = await tx.$queryRawUnsafe(
    'SELECT id, last_number, prefix FROM invoice_sequences WHERE branch_id = ? AND financial_year = ? FOR UPDATE',
    branch.id,
    financialYear,
  );
  const next = BigInt(rows[0].last_number) + 1n;
  await tx.invoiceSequence.update({ where: { id: rows[0].id }, data: { last_number: next } });
  return `${rows[0].prefix}/${financialYear}/${String(next).padStart(6, '0')}`;
};

export const runTransaction = (work) => prisma.$transaction(work);

export const findDeviceByUuid = (deviceUuid) => prisma.syncDevice.findUnique({ where: { device_uuid: deviceUuid } });
export const createDeviceRecord = (data) => prisma.syncDevice.create({ data });
export const listDeviceRecords = (where) => prisma.syncDevice.findMany({ where, orderBy: { created_at: 'desc' } });
export const touchDevice = (id, tx) => db(tx).syncDevice.update({ where: { id: BigInt(id) }, data: { last_sync_at: new Date() } });
export const createSyncLog = (data, tx) => db(tx).syncLog.create({ data });
export const finishSyncLog = (id, data, tx) => db(tx).syncLog.update({ where: { id: BigInt(id) }, data });
export const createOutboxRecord = (data, tx) => db(tx).syncOutbox.create({ data });
export const updateOutboxRecord = (id, data) => prisma.syncOutbox.update({ where: { id: BigInt(id) }, data });

export const listChangedCustomers = (since) => prisma.customer.findMany({ where: { updated_at: { gte: since } }, orderBy: { updated_at: 'asc' } });
export const listChangedProducts = (since) =>
  prisma.product.findMany({ where: { updated_at: { gte: since } }, include: { variants: true }, orderBy: { updated_at: 'asc' } });
export const listChangedOffers = (since) => prisma.offer.findMany({ where: { updated_at: { gte: since } }, include: offerInclude, orderBy: { updated_at: 'asc' } });
export const listChangedTaxRates = (since) => prisma.taxRate.findMany({ where: { updated_at: { gte: since } } });
export const listUnits = () => prisma.unit.findMany();
export const listChangedPrices = (branchId, since) =>
  prisma.branchProductPrice.findMany({ where: { branch_id: BigInt(branchId), updated_at: { gte: since } } });
export const listReturnItemsForInvoice = (invoiceId, tx) =>
  db(tx).salesReturnItem.findMany({
    where: { sales_return: { invoice_id: BigInt(invoiceId) } },
    select: {
      invoice_item_id: true,
      product_variant_id: true,
      quantity: true,
      sales_return: { select: { refund_amount: true, id: true } },
    },
  });

export const createReturnRecord = (data, tx) => db(tx).salesReturn.create({ data, include: returnInclude });

export const updateReturnNumber = (id, returnNumber, tx) =>
  db(tx).salesReturn.update({ where: { id: BigInt(id) }, data: { return_number: returnNumber }, include: returnInclude });

export const listReturnRecords = (where) => prisma.salesReturn.findMany({ where, include: returnInclude, orderBy: { return_date: 'desc' } });

export const getReturnRecord = (id) => prisma.salesReturn.findUnique({ where: { id: BigInt(id) }, include: returnInclude });

export const listFailedOutbox = (deviceId) =>
  prisma.syncOutbox.findMany({
    where: {
      device_id: BigInt(deviceId),
      status: { in: ['failed', 'stored'] },
      retry_count: { lt: 5 },
      entity_type: { in: ['customer', 'sales_invoice', 'payment', 'sales_return'] },
    },
    orderBy: { id: 'asc' },
    take: 50,
  });

export const findLatestOutbox = (deviceId, entityType, entityId, operationType) =>
  prisma.syncOutbox.findFirst({
    where: {
      device_id: BigInt(deviceId),
      entity_type: entityType,
      entity_id: String(entityId),
      operation_type: operationType,
    },
    orderBy: { id: 'desc' },
  });

export const findSyncedOutbox = (deviceId, entityType, entityId) =>
  prisma.syncOutbox.findFirst({
    where: {
      device_id: BigInt(deviceId),
      entity_type: entityType,
      entity_id: String(entityId),
      status: 'synced',
      server_entity_id: { not: null },
    },
    orderBy: { id: 'desc' },
  });

export const listOutboxForDevice = (deviceId, status) =>
  prisma.syncOutbox.findMany({
    where: { device_id: BigInt(deviceId), status: status || undefined },
    orderBy: { id: 'desc' },
    take: 100,
    select: {
      id: true,
      entity_type: true,
      entity_id: true,
      operation_type: true,
      status: true,
      retry_count: true,
      last_error: true,
      server_entity_id: true,
      created_at: true,
      synced_at: true,
    },
  });

export const countOutboxByStatus = (deviceId) =>
  prisma.syncOutbox.groupBy({
    by: ['status'],
    where: { device_id: BigInt(deviceId) },
    _count: { _all: true },
  });

export const listSyncLogs = (deviceId) =>
  prisma.syncLog.findMany({
    where: { device_id: BigInt(deviceId) },
    orderBy: { started_at: 'desc' },
    take: 20,
  });

export const listChangedReturns = (branchId, since) =>
  prisma.salesReturn.findMany({
    where: { branch_id: BigInt(branchId), created_at: { gte: since } },
    include: returnInclude,
    orderBy: { created_at: 'asc' },
  });

export const listChangedInvoices = (branchId, since) =>
  prisma.salesInvoice.findMany({ where: { branch_id: BigInt(branchId), updated_at: { gte: since } }, include: invoiceInclude });
export const listChangedVersions = (since) => prisma.syncEntityVersion.findMany({ where: { updated_at: { gte: since } } });
