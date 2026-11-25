import { ApiError } from '../utils/ApiError.js';
import {
  createCustomerRecord,
  findCustomerByCode,
  getCustomerRecordById,
  listCustomerRecords,
  updateCustomerRecord,
} from '../models/customer.model.js';

const assertUniqueCode = async (customerCode, currentId) => {
  if (!customerCode) {
    return;
  }

  const existing = await findCustomerByCode(customerCode);
  if (existing && Number(existing.id) !== Number(currentId)) {
    throw new ApiError(409, 'Customer code already exists');
  }
};

const withGeneratedCode = async (customer) => {
  if (customer.customer_code) {
    return customer;
  }

  const customerCode = `CUS${String(customer.id).padStart(6, '0')}`;
  return updateCustomerRecord(customer.id, { customer_code: customerCode });
};

export const createCustomer = async (payload) => {
  await assertUniqueCode(payload.customer_code);
  const customer = await createCustomerRecord(payload);
  return withGeneratedCode(customer);
};

export const getCustomers = (search) => listCustomerRecords(search);

export const getCustomer = async (id) => {
  const customer = await getCustomerRecordById(id);
  if (!customer) {
    throw new ApiError(404, 'Customer not found');
  }
  return customer;
};

export const updateCustomer = async (id, payload) => {
  await getCustomer(id);
  await assertUniqueCode(payload.customer_code, id);
  return updateCustomerRecord(id, payload);
};
