import { cancelSalesInvoice, createSalesInvoice } from '../services/invoice.service.js';
import * as billingService from '../services/billing.service.js';
import * as syncService from '../services/sync.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const created = (res, data, message) => res.status(201).json(new ApiResponse(201, data, message));
const ok = (res, data, message) => res.status(200).json(new ApiResponse(200, data, message));

export const createPaymentMode = asyncHandler(async (req, res) => created(res, await billingService.createPaymentMode(req.body), 'Payment mode created successfully'));
export const getPaymentModes = asyncHandler(async (req, res) => ok(res, await billingService.getPaymentModes(), 'Payment modes fetched successfully'));
export const updatePaymentMode = asyncHandler(async (req, res) => ok(res, await billingService.updatePaymentMode(req.params.id, req.body), 'Payment mode updated successfully'));

export const createOffer = asyncHandler(async (req, res) => created(res, await billingService.createOffer(req.body, req.user), 'Offer created successfully'));
export const getOffers = asyncHandler(async (req, res) => ok(res, await billingService.getOffers(req.query, req.user), 'Offers fetched successfully'));
export const getOffer = asyncHandler(async (req, res) => ok(res, await billingService.getOffer(req.params.id), 'Offer fetched successfully'));
export const updateOffer = asyncHandler(async (req, res) => ok(res, await billingService.updateOffer(req.params.id, req.body), 'Offer updated successfully'));

export const createInvoice = asyncHandler(async (req, res) => created(res, await createSalesInvoice(req.body, req.user), 'Invoice created successfully'));
export const getInvoices = asyncHandler(async (req, res) => ok(res, await billingService.getInvoices(req.query, req.user), 'Invoices fetched successfully'));
export const getInvoice = asyncHandler(async (req, res) => ok(res, await billingService.getInvoice(req.params.id, req.user), 'Invoice fetched successfully'));
export const cancelInvoice = asyncHandler(async (req, res) => ok(res, await cancelSalesInvoice(req.params.id, req.user), 'Invoice cancelled successfully'));

export const addPayment = asyncHandler(async (req, res) => created(res, await billingService.addPayment(req.params.id, req.body, req.user), 'Payment recorded successfully'));
export const getPayments = asyncHandler(async (req, res) => ok(res, await billingService.getPayments(req.query, req.user), 'Payments fetched successfully'));
export const createReturn = asyncHandler(async (req, res) => created(res, await billingService.createReturn(req.params.id, req.body, req.user), 'Sales return created successfully'));
export const getReturns = asyncHandler(async (req, res) => ok(res, await billingService.getReturns(req.query, req.user), 'Sales returns fetched successfully'));
export const getReturn = asyncHandler(async (req, res) => ok(res, await billingService.getReturn(req.params.id, req.user), 'Sales return fetched successfully'));
export const getDailySales = asyncHandler(async (req, res) => ok(res, await billingService.getDailySales(req.query, req.user), 'Daily sales fetched successfully'));
export const getMonthlySales = asyncHandler(async (req, res) => ok(res, await billingService.getMonthlySales(req.query, req.user), 'Monthly sales fetched successfully'));
export const getSalespersonSales = asyncHandler(async (req, res) => ok(res, await billingService.getSalespersonSales(req.query, req.user), 'Salesperson sales fetched successfully'));
export const getActivity = asyncHandler(async (req, res) => ok(res, await billingService.getActivity(req.query, req.user), 'Activity fetched successfully'));

export const registerDevice = asyncHandler(async (req, res) => created(res, await syncService.registerDevice(req.body, req.user), 'Device registered successfully'));
export const getDevices = asyncHandler(async (req, res) => ok(res, await syncService.getDevices(req.query, req.user), 'Devices fetched successfully'));
export const getSyncStatus = asyncHandler(async (req, res) => ok(res, await syncService.getSyncStatus(req.query, req.user), 'Sync status fetched successfully'));
export const pullChanges = asyncHandler(async (req, res) => ok(res, await syncService.pullChanges(req.query, req.user), 'Changes fetched successfully'));
export const pushChanges = asyncHandler(async (req, res) => ok(res, await syncService.pushChanges(req.body, req.user), 'Changes pushed successfully'));
export const retrySync = asyncHandler(async (req, res) => ok(res, await syncService.retryFailedSync(req.body.device_uuid, req.user), 'Failed sync records retried'));
