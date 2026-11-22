import * as businessService from '../services/business.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const createBusiness = asyncHandler(async (req, res) => {
  const business = await businessService.createBusiness(req.body);

  return res.status(201).json(new ApiResponse(201, business, 'Business created successfully'));
});

export const getAllBusinesses = asyncHandler(async (req, res) => {
  const businesses = await businessService.getAllBusinesses();

  return res.status(200).json(new ApiResponse(200, businesses, 'Businesses fetched successfully'));
});

export const getBusinessById = asyncHandler(async (req, res) => {
  const business = await businessService.getBusinessById(req.params.id);

  return res.status(200).json(new ApiResponse(200, business, 'Business fetched successfully'));
});
