import { ApiError } from '../utils/ApiError.js';
import { assertBranchAccess, branchScope, shapeRecord } from '../utils/billing.js';
import { addPaymentSchema, createInvoiceSchema, createReturnSchema } from '../schemas/billing.schema.js';
import { createCustomerSchema, updateCustomerSchema } from '../schemas/customer.schema.js';
import { findCustomerByCode } from '../models/customer.model.js';
import { createCustomer, updateCustomer } from './customer.service.js';
import { addPayment, cancelSalesInvoice, createSalesInvoice, createSalesReturn } from './invoice.service.js';
import {
  countOutboxByStatus,
  createDeviceRecord,
  createOutboxRecord,
  createSyncLog,
  findDeviceByUuid,
  findInvoiceByNumber,
  findLatestOutbox,
  findSyncedOutbox,
  finishSyncLog,
  listChangedCustomers,
  listChangedInvoices,
  listChangedOffers,
  listChangedPrices,
  listChangedProducts,
  listChangedReturns,
  listChangedTaxRates,
  listChangedVersions,
  listDeviceRecords,
  listFailedOutbox,
  listOutboxForDevice,
  listSyncLogs,
  listUnits,
  runTransaction,
  touchDevice,
  updateOutboxRecord,
} from '../models/billing.model.js';

const requireDevice = async (deviceUuid, user) => {
  const device = await findDeviceByUuid(deviceUuid);
  if (!device || !device.is_active) {
    throw new ApiError(404, 'Sync device not found');
  }
  assertBranchAccess(user, device.branch_id);
  return device;
};

export const registerDevice = async (payload, user) => {
  assertBranchAccess(user, payload.branch_id);
  const existing = await findDeviceByUuid(payload.device_uuid);
  if (existing) {
    if (Number(existing.branch_id) !== Number(payload.branch_id)) {
      throw new ApiError(409, 'Device is already registered to another branch');
    }
    return shapeRecord(existing);
  }
  return shapeRecord(await createDeviceRecord({ ...payload, branch_id: BigInt(payload.branch_id) }));
};

export const getDevices = async (query, user) => {
  const scope = branchScope(user, query.branch_id);
  return shapeRecord(await listDeviceRecords({ branch_id: scope }));
};

export const pullChanges = async (query, user) => {
  const device = await requireDevice(query.device_uuid, user);
  const since = query.since ? new Date(query.since) : new Date(0);
  if (Number.isNaN(since.getTime())) {
    throw new ApiError(400, 'since must be a valid date');
  }
  const [customers, products, offers, taxRates, units, prices, invoices, returns, versions] = await Promise.all([
    listChangedCustomers(since),
    listChangedProducts(since),
    listChangedOffers(since),
    listChangedTaxRates(since),
    listUnits(),
    listChangedPrices(device.branch_id, since),
    listChangedInvoices(device.branch_id, since),
    listChangedReturns(device.branch_id, since),
    listChangedVersions(since),
  ]);
  const started = new Date();
  await createSyncLog({
    device_id: device.id,
    sync_type: 'pull',
    started_at: started,
    completed_at: new Date(),
    status: 'success',
    records_sent: customers.length + products.length + invoices.length,
    records_received: 0,
  });
  await touchDevice(device.id);
  return shapeRecord({
    server_time: new Date().toISOString(),
    customers,
    products,
    offers,
    tax_rates: taxRates,
    units,
    branch_prices: prices,
    sales_invoices: invoices,
    sales_returns: returns,
    entity_versions: versions,
  });
};

const resultOf = (outbox, extra) => ({
  entity_id: outbox.entity_id,
  entity_type: outbox.entity_type,
  operation_type: outbox.operation_type,
  ...extra,
});

const remember = (memoryMap, outbox, serverId) => {
  if (serverId != null) {
    memoryMap.set(`${outbox.entity_type}:${outbox.entity_id}`, Number(serverId));
  }
};

const markSynced = async (outbox, serverId, status, memoryMap, extra = {}) => {
  await updateOutboxRecord(outbox.id, {
    status: 'synced',
    synced_at: new Date(),
    last_error: null,
    server_entity_id: serverId == null ? null : String(serverId),
  });
  remember(memoryMap, outbox, serverId);
  return resultOf(outbox, {
    status,
    server_id: serverId == null ? null : Number(serverId),
    ...extra,
  });
};

const markFailed = async (outbox, message) => {
  await updateOutboxRecord(outbox.id, {
    status: 'failed',
    last_error: message,
    retry_count: { increment: 1 },
  });
  return resultOf(outbox, { status: 'failed', message });
};

const validationMessage = (parsed) => parsed.error.issues[0]?.message || 'Invalid sync payload';

const resolveServerId = async (deviceId, entityType, localId, memoryMap) => {
  if (localId == null || localId === '') {
    return null;
  }
  const key = `${entityType}:${localId}`;
  if (memoryMap.has(key)) {
    return memoryMap.get(key);
  }
  const synced = await findSyncedOutbox(deviceId, entityType, localId);
  if (synced?.server_entity_id) {
    return Number(synced.server_entity_id);
  }
  if (/^[1-9]\d*$/.test(String(localId))) {
    return Number(localId);
  }
  return null;
};

const applyCustomerCreate = async (outbox, payload, memoryMap) => {
  const parsed = createCustomerSchema.safeParse({ body: payload });
  if (!parsed.success) {
    return markFailed(outbox, validationMessage(parsed));
  }
  try {
    const customer = await createCustomer(parsed.data.body);
    return markSynced(outbox, customer.id, 'synced', memoryMap);
  } catch (error) {
    if (error.statusCode === 409 && payload.customer_code) {
      const existing = await findCustomerByCode(payload.customer_code);
      if (existing) {
        return markSynced(outbox, existing.id, 'duplicate', memoryMap);
      }
    }
    return markFailed(outbox, error.statusCode ? error.message : 'Customer could not be saved');
  }
};

const applyCustomerUpdate = async (outbox, payload, device, memoryMap) => {
  const serverId = await resolveServerId(device.id, 'customer', payload.customer_id || outbox.entity_id, memoryMap);
  if (!serverId) {
    return markFailed(outbox, 'Customer has not synced yet');
  }
  const { customer_id: _customerId, customer_entity_id: _customerEntityId, id: _id, ...body } = payload;
  const parsed = updateCustomerSchema.safeParse({ body });
  if (!parsed.success) {
    return markFailed(outbox, validationMessage(parsed));
  }
  try {
    const customer = await updateCustomer(serverId, parsed.data.body);
    return markSynced(outbox, customer.id, 'synced', memoryMap);
  } catch (error) {
    return markFailed(outbox, error.statusCode ? error.message : 'Customer could not be updated');
  }
};

const applyInvoiceCreate = async (outbox, payload, user, device, memoryMap) => {
  const raw = { ...payload, branch_id: Number(device.branch_id) };
  if (!raw.customer_id && raw.customer_entity_id) {
    raw.customer_id = await resolveServerId(device.id, 'customer', raw.customer_entity_id, memoryMap);
    if (!raw.customer_id) {
      return markFailed(outbox, 'Customer has not synced yet');
    }
  }
  delete raw.customer_entity_id;
  delete raw.invoice_entity_id;
  const parsed = createInvoiceSchema.safeParse({ body: raw });
  if (!parsed.success) {
    return markFailed(outbox, validationMessage(parsed));
  }
  try {
    const invoice = await createSalesInvoice(parsed.data.body, user, device.id);
    return markSynced(outbox, invoice.id, 'synced', memoryMap, {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      items: (invoice.items || []).map((item) => ({
        id: item.id,
        product_variant_id: item.product_variant_id,
      })),
    });
  } catch (error) {
    if (error.statusCode === 409) {
      const existing = raw.invoice_number ? await findInvoiceByNumber(device.branch_id, raw.invoice_number) : null;
      return markSynced(outbox, existing?.id ?? null, 'duplicate', memoryMap, {
        message: error.message,
        invoice_id: existing ? Number(existing.id) : null,
      });
    }
    return markFailed(outbox, error.statusCode ? error.message : 'Invoice could not be saved');
  }
};

const resolveInvoiceId = async (payload, device, memoryMap) => {
  if (payload.invoice_id) {
    return resolveServerId(device.id, 'sales_invoice', payload.invoice_id, memoryMap);
  }
  if (payload.invoice_entity_id) {
    return resolveServerId(device.id, 'sales_invoice', payload.invoice_entity_id, memoryMap);
  }
  return null;
};

const applyInvoiceCancel = async (outbox, payload, user, device, memoryMap) => {
  const invoiceId = await resolveInvoiceId(payload, device, memoryMap);
  if (!invoiceId) {
    return markFailed(outbox, 'Invoice has not synced yet');
  }
  try {
    await cancelSalesInvoice(invoiceId, user);
    return markSynced(outbox, invoiceId, 'synced', memoryMap, { invoice_id: invoiceId });
  } catch (error) {
    if (error.statusCode === 400 && error.message === 'Invoice is already cancelled') {
      return markSynced(outbox, invoiceId, 'duplicate', memoryMap, { invoice_id: invoiceId });
    }
    return markFailed(outbox, error.statusCode ? error.message : 'Invoice could not be cancelled');
  }
};

const applyPayment = async (outbox, payload, user, device, memoryMap) => {
  const invoiceId = await resolveInvoiceId(payload, device, memoryMap);
  if (!invoiceId) {
    return markFailed(outbox, 'Invoice has not synced yet');
  }
  const { invoice_id: _invoiceId, invoice_entity_id: _invoiceEntityId, ...body } = payload;
  const parsed = addPaymentSchema.safeParse({ body });
  if (!parsed.success) {
    return markFailed(outbox, validationMessage(parsed));
  }
  try {
    await addPayment(invoiceId, parsed.data.body, user);
    return markSynced(outbox, invoiceId, 'synced', memoryMap, { invoice_id: invoiceId });
  } catch (error) {
    return markFailed(outbox, error.statusCode ? error.message : 'Payment could not be saved');
  }
};

const applyReturn = async (outbox, payload, user, device, memoryMap) => {
  const invoiceId = await resolveInvoiceId(payload, device, memoryMap);
  if (!invoiceId) {
    return markFailed(outbox, 'Invoice has not synced yet');
  }
  const { invoice_id: _invoiceId, invoice_entity_id: _invoiceEntityId, ...body } = payload;
  const parsed = createReturnSchema.safeParse({ body });
  if (!parsed.success) {
    return markFailed(outbox, validationMessage(parsed));
  }
  try {
    const salesReturn = await createSalesReturn(invoiceId, parsed.data.body, user);
    return markSynced(outbox, salesReturn.id, 'synced', memoryMap, { invoice_id: invoiceId });
  } catch (error) {
    return markFailed(outbox, error.statusCode ? error.message : 'Sales return could not be saved');
  }
};

const applyOutbox = async (outbox, user, device, memoryMap) => {
  let payload;
  try {
    payload = JSON.parse(outbox.payload);
  } catch {
    return markFailed(outbox, 'Invalid sync payload');
  }
  const action = `${outbox.entity_type}:${outbox.operation_type}`;
  if (action === 'customer:create') {
    return applyCustomerCreate(outbox, payload, memoryMap);
  }
  if (action === 'customer:update') {
    return applyCustomerUpdate(outbox, payload, device, memoryMap);
  }
  if (action === 'sales_invoice:create') {
    return applyInvoiceCreate(outbox, payload, user, device, memoryMap);
  }
  if (action === 'sales_invoice:cancel') {
    return applyInvoiceCancel(outbox, payload, user, device, memoryMap);
  }
  if (action === 'payment:create') {
    return applyPayment(outbox, payload, user, device, memoryMap);
  }
  if (action === 'sales_return:create') {
    return applyReturn(outbox, payload, user, device, memoryMap);
  }
  return markFailed(outbox, 'This sync record is not supported');
};

export const getSyncStatus = async (query, user) => {
  const device = await requireDevice(query.device_uuid, user);
  const [counts, records, logs] = await Promise.all([
    countOutboxByStatus(device.id),
    listOutboxForDevice(device.id, query.status),
    listSyncLogs(device.id),
  ]);
  const summary = { pending: 0, failed: 0, stored: 0, synced: 0 };
  counts.forEach((row) => {
    summary[row.status] = row._count._all;
  });
  return shapeRecord({
    device_id: device.id,
    device_uuid: device.device_uuid,
    device_name: device.device_name,
    branch_id: device.branch_id,
    last_sync_at: device.last_sync_at,
    summary,
    records,
    logs,
  });
};

export const retryFailedSync = async (deviceUuid, user, memoryMap = new Map()) => {
  const device = await requireDevice(deviceUuid, user);
  const failed = await listFailedOutbox(device.id);
  const results = [];
  for (const outbox of failed) {
    results.push(await applyOutbox(outbox, user, device, memoryMap));
  }
  if (results.length) {
    await createSyncLog({
      device_id: device.id,
      sync_type: 'retry',
      started_at: new Date(),
      completed_at: new Date(),
      status: results.some((result) => result.status === 'failed') ? 'failed' : 'success',
      records_received: results.length,
      records_sent: results.filter((result) => result.status === 'synced').length,
    });
  }
  await touchDevice(device.id);
  return { device_id: Number(device.id), retried: results.length, results };
};

export const pushChanges = async (payload, user) => {
  const device = await requireDevice(payload.device_uuid, user);
  const memoryMap = new Map();
  const retryResults = await retryFailedSync(device.device_uuid, user, memoryMap);
  const started = new Date();
  const log = await createSyncLog({
    device_id: device.id,
    sync_type: 'push',
    started_at: started,
    status: 'pending',
    records_received: payload.records.length,
  });
  const results = [];
  for (const record of payload.records) {
    const previous = await findLatestOutbox(device.id, record.entity_type, record.entity_id, record.operation_type);
    if (previous?.status === 'synced') {
      results.push(
        resultOf(previous, {
          status: 'duplicate',
          server_id: previous.server_entity_id ? Number(previous.server_entity_id) : null,
        })
      );
      continue;
    }
    const payloadText = JSON.stringify(record.payload);
    const outbox =
      previous && ['failed', 'stored', 'pending'].includes(previous.status)
        ? previous
        : await runTransaction((tx) =>
            createOutboxRecord(
              {
                device_id: device.id,
                entity_type: record.entity_type,
                entity_id: record.entity_id,
                operation_type: record.operation_type,
                payload: payloadText,
                status: 'pending',
              },
              tx
            )
          );
    if (previous && outbox.id === previous.id) {
      await updateOutboxRecord(previous.id, { payload: payloadText, status: 'pending', last_error: null });
    }
    results.push(await applyOutbox({ ...outbox, payload: payloadText }, user, device, memoryMap));
  }
  const failed = results.some((result) => result.status === 'failed');
  await finishSyncLog(log.id, {
    completed_at: new Date(),
    status: failed ? 'failed' : 'success',
    records_sent: results.filter((result) => result.status === 'synced').length,
  });
  await touchDevice(device.id);
  return { device_id: Number(device.id), retried: retryResults.results, results };
};
