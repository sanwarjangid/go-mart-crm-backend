import { Router } from 'express';
import { changePassword, login, me } from '../controllers/auth.controller.js';
import {
  addPayment,
  cancelInvoice,
  createInvoice,
  createOffer,
  createPaymentMode,
  getActivity,
  getDailySales,
  getMonthlySales,
  getReturn,
  getReturns,
  getSalespersonSales,
  createReturn,
  getDevices,
  getInvoice,
  getInvoices,
  getOffer,
  getOffers,
  getPaymentModes,
  getPayments,
  getSyncStatus,
  pullChanges,
  pushChanges,
  retrySync,
  registerDevice,
  updateOffer,
  updatePaymentMode,
} from '../controllers/billing.controller.js';
import { createCustomer, getCustomer, getCustomers, updateCustomer } from '../controllers/customer.controller.js';
import {
  createCategory,
  createProduct,
  createTaxRate,
  createUnit,
  createVariant,
  getBranchPrices,
  getCategories,
  getCategory,
  getProduct,
  getProducts,
  getTaxRate,
  getTaxRates,
  getUnit,
  getUnits,
  getVariants,
  saveBranchPrice,
  updateCategory,
  updateProduct,
  updateTaxRate,
  updateUnit,
  updateVariant,
} from '../controllers/product.controller.js';
import { createBranch, getAllBranches, getBranchById, updateBranch } from '../controllers/branch.controller.js';
import { addCashMovement, closeCashShift, getCashShift, getCashShifts, getCounters, openCashShift } from '../controllers/cash.controller.js';
import { createBusiness, getAllBusinesses, getBusinessById } from '../controllers/business.controller.js';
import { assignPermissions, createRole, getPermissions, getRoles, updateRole } from '../controllers/role.controller.js';
import { assignBranches, createUser, getUser, getUsers, resetUserPassword, updateUser, updateUserStatus } from '../controllers/user.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { validate, validateIdParam } from '../middlewares/validate.middleware.js';
import { changePasswordSchema, loginSchema } from '../schemas/auth.schema.js';
import { createBranchSchema, updateBranchSchema } from '../schemas/branch.schema.js';
import { createBusinessSchema } from '../schemas/business.schema.js';
import {
  addPaymentSchema,
  createInvoiceSchema,
  createOfferSchema,
  createPaymentModeSchema,
  createReturnSchema,
  dailySalesSchema,
  listReturnSchema,
  monthlySalesSchema,
  salespersonSalesSchema,
  syncRetrySchema,
  listActivitySchema,
  listDeviceSchema,
  listInvoiceSchema,
  listOfferSchema,
  listPaymentSchema,
  registerDeviceSchema,
  syncPullSchema,
  syncPushSchema,
  syncStatusSchema,
  updateOfferSchema,
  updatePaymentModeSchema,
} from '../schemas/billing.schema.js';
import { createCustomerSchema, listCustomerSchema, updateCustomerSchema } from '../schemas/customer.schema.js';
import {
  createCategorySchema,
  createProductSchema,
  createTaxRateSchema,
  createUnitSchema,
  createVariantSchema,
  listBranchPriceSchema,
  listProductSchema,
  updateCategorySchema,
  updateProductSchema,
  updateTaxRateSchema,
  updateUnitSchema,
  updateVariantSchema,
  upsertBranchPriceSchema,
} from '../schemas/product.schema.js';
import { assignPermissionsSchema, createRoleSchema, updateRoleSchema } from '../schemas/role.schema.js';
import { assignBranchesSchema, createUserSchema, resetUserPasswordSchema, updateUserSchema, updateUserStatusSchema } from '../schemas/user.schema.js';
import { cashMovementSchema, closeCashShiftSchema, listCashSchema, openCashShiftSchema } from '../schemas/cash.schema.js';

const router = Router();

router.post('/auth/login', validate(loginSchema), login);
router.get('/auth/me', authenticate, me);
router.post('/auth/change-password', authenticate, validate(changePasswordSchema), changePassword);

router.post('/users', authenticate, authorize('users.create'), validate(createUserSchema), createUser);
router.get('/users', authenticate, authorize('users.read'), getUsers);
router.get('/users/:id', authenticate, authorize('users.read'), validateIdParam, getUser);
router.put('/users/:id', authenticate, authorize('users.update'), validateIdParam, validate(updateUserSchema), updateUser);
router.patch('/users/:id/password', authenticate, authorize('users.update'), validateIdParam, validate(resetUserPasswordSchema), resetUserPassword);
router.patch('/users/:id/status', authenticate, authorize('users.status'), validateIdParam, validate(updateUserStatusSchema), updateUserStatus);
router.put('/users/:id/branches', authenticate, authorize('users.assign_branches'), validateIdParam, validate(assignBranchesSchema), assignBranches);

router.get('/roles', authenticate, authorize('roles.read'), getRoles);
router.post('/roles', authenticate, authorize('roles.create'), validate(createRoleSchema), createRole);
router.put('/roles/:id', authenticate, authorize('roles.update'), validateIdParam, validate(updateRoleSchema), updateRole);
router.get('/permissions', authenticate, authorize('permissions.read'), getPermissions);
router.put('/roles/:id/permissions', authenticate, authorize('roles.assign_permissions'), validateIdParam, validate(assignPermissionsSchema), assignPermissions);

router.post('/businesses', validate(createBusinessSchema), createBusiness);
router.get('/businesses', getAllBusinesses);
router.get('/businesses/:id', validateIdParam, getBusinessById);

router.post('/units', authenticate, authorize('products.create'), validate(createUnitSchema), createUnit);
router.get('/units', authenticate, authorize('products.read'), getUnits);
router.get('/units/:id', authenticate, authorize('products.read'), validateIdParam, getUnit);
router.put('/units/:id', authenticate, authorize('products.update'), validateIdParam, validate(updateUnitSchema), updateUnit);

router.post('/tax-rates', authenticate, authorize('products.create'), validate(createTaxRateSchema), createTaxRate);
router.get('/tax-rates', authenticate, authorize('products.read'), getTaxRates);
router.get('/tax-rates/:id', authenticate, authorize('products.read'), validateIdParam, getTaxRate);
router.put('/tax-rates/:id', authenticate, authorize('products.update'), validateIdParam, validate(updateTaxRateSchema), updateTaxRate);

router.post('/product-categories', authenticate, authorize('products.create'), validate(createCategorySchema), createCategory);
router.get('/product-categories', authenticate, authorize('products.read'), getCategories);
router.get('/product-categories/:id', authenticate, authorize('products.read'), validateIdParam, getCategory);
router.put('/product-categories/:id', authenticate, authorize('products.update'), validateIdParam, validate(updateCategorySchema), updateCategory);

router.post('/products', authenticate, authorize('products.create'), validate(createProductSchema), createProduct);
router.get('/products', authenticate, authorize('products.read'), validate(listProductSchema), getProducts);
router.get('/products/:id', authenticate, authorize('products.read'), validateIdParam, getProduct);
router.put('/products/:id', authenticate, authorize('products.update'), validateIdParam, validate(updateProductSchema), updateProduct);
router.post('/products/:id/variants', authenticate, authorize('products.create'), validateIdParam, validate(createVariantSchema), createVariant);
router.get('/products/:id/variants', authenticate, authorize('products.read'), validateIdParam, getVariants);
router.put('/product-variants/:id', authenticate, authorize('products.update'), validateIdParam, validate(updateVariantSchema), updateVariant);

router.get('/branch-product-prices', authenticate, authorize('products.read'), validate(listBranchPriceSchema), getBranchPrices);
router.put('/branch-product-prices', authenticate, authorize('products.update'), validate(upsertBranchPriceSchema), saveBranchPrice);

router.post('/payment-modes', authenticate, authorize('payment_modes.create'), validate(createPaymentModeSchema), createPaymentMode);
router.get('/payment-modes', authenticate, authorize('payment_modes.read'), getPaymentModes);
router.put('/payment-modes/:id', authenticate, authorize('payment_modes.update'), validateIdParam, validate(updatePaymentModeSchema), updatePaymentMode);

router.post('/offers', authenticate, authorize('offers.create'), validate(createOfferSchema), createOffer);
router.get('/offers', authenticate, authorize('offers.read'), validate(listOfferSchema), getOffers);
router.get('/offers/:id', authenticate, authorize('offers.read'), validateIdParam, getOffer);
router.put('/offers/:id', authenticate, authorize('offers.update'), validateIdParam, validate(updateOfferSchema), updateOffer);

router.post('/sales-invoices', authenticate, authorize('invoices.create'), validate(createInvoiceSchema), createInvoice);
router.get('/sales-invoices', authenticate, authorize('invoices.read'), validate(listInvoiceSchema), getInvoices);
router.get('/sales-invoices/:id', authenticate, authorize('invoices.read'), validateIdParam, getInvoice);
router.patch('/sales-invoices/:id/cancel', authenticate, authorize('invoices.cancel'), validateIdParam, cancelInvoice);
router.post('/sales-invoices/:id/returns', authenticate, authorize('invoices.return'), validateIdParam, validate(createReturnSchema), createReturn);
router.get('/sales-returns', authenticate, authorize('invoices.read'), validate(listReturnSchema), getReturns);
router.get('/sales-returns/:id', authenticate, authorize('invoices.read'), validateIdParam, getReturn);
router.post('/sales-invoices/:id/payments', authenticate, authorize('payments.create'), validateIdParam, validate(addPaymentSchema), addPayment);
router.get('/payments', authenticate, authorize('payments.read'), validate(listPaymentSchema), getPayments);

router.get('/reports/daily-sales', authenticate, authorize('reports.read'), validate(dailySalesSchema), getDailySales);
router.get('/reports/monthly-sales', authenticate, authorize('reports.read'), validate(monthlySalesSchema), getMonthlySales);
router.get('/reports/salesperson-sales', authenticate, authorize('reports.read'), validate(salespersonSalesSchema), getSalespersonSales);
router.get('/activity-logs', authenticate, authorize('activity_logs.read'), validate(listActivitySchema), getActivity);

router.post('/sync/devices', authenticate, authorize('sync.push'), validate(registerDeviceSchema), registerDevice);
router.get('/sync/devices', authenticate, authorize('sync.pull'), validate(listDeviceSchema), getDevices);
router.get('/sync/status', authenticate, authorize('sync.pull'), validate(syncStatusSchema), getSyncStatus);
router.get('/sync/pull', authenticate, authorize('sync.pull'), validate(syncPullSchema), pullChanges);
router.post('/sync/push', authenticate, authorize('sync.push'), validate(syncPushSchema), pushChanges);
router.post('/sync/retry', authenticate, authorize('sync.push'), validate(syncRetrySchema), retrySync);

router.post('/customers', authenticate, authorize('customers.create'), validate(createCustomerSchema), createCustomer);
router.get('/customers', authenticate, authorize('customers.read'), validate(listCustomerSchema), getCustomers);
router.get('/customers/:id', authenticate, authorize('customers.read'), validateIdParam, getCustomer);
router.put('/customers/:id', authenticate, authorize('customers.update'), validateIdParam, validate(updateCustomerSchema), updateCustomer);

router.get('/counters', authenticate, authorize('cash_shifts.read'), validate(listCashSchema), getCounters);
router.get('/cash-shifts', authenticate, authorize('cash_shifts.read'), validate(listCashSchema), getCashShifts);
router.post('/cash-shifts/open', authenticate, authorize('cash_shifts.manage'), validate(openCashShiftSchema), openCashShift);
router.get('/cash-shifts/:id', authenticate, authorize('cash_shifts.read'), validateIdParam, getCashShift);
router.post('/cash-shifts/:id/movements', authenticate, authorize('cash_shifts.manage'), validateIdParam, validate(cashMovementSchema), addCashMovement);
router.post('/cash-shifts/:id/close', authenticate, authorize('cash_shifts.manage'), validateIdParam, validate(closeCashShiftSchema), closeCashShift);

router.post('/branches', authenticate, authorize('branches.create'), validate(createBranchSchema), createBranch);
router.get('/branches', authenticate, authorize('branches.read'), getAllBranches);
router.get('/branches/:id', authenticate, authorize('branches.read'), validateIdParam, getBranchById);
router.put('/branches/:id', authenticate, authorize('branches.update'), validateIdParam, validate(updateBranchSchema), updateBranch);

export default router;
