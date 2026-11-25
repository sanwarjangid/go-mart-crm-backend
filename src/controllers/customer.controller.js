import * as customerService from '../services/customer.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const createCustomer = asyncHandler(async (req, res) => {
  const customer = await customerService.createCustomer(req.body);
  return res.status(201).json(new ApiResponse(201, customer, 'Customer created successfully'));
});

export const getCustomers = asyncHandler(async (req, res) => {
  const customers = await customerService.getCustomers(req.query.search);
  return res.status(200).json(new ApiResponse(200, customers, 'Customers fetched successfully'));
});

export const getCustomer = asyncHandler(async (req, res) => {
  const customer = await customerService.getCustomer(req.params.id);
  return res.status(200).json(new ApiResponse(200, customer, 'Customer fetched successfully'));
});

export const updateCustomer = asyncHandler(async (req, res) => {
  const customer = await customerService.updateCustomer(req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, customer, 'Customer updated successfully'));
});
