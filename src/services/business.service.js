import { ApiError } from '../utils/ApiError.js';
import {
  createBusinessRecord,
  getAllBusinessRecords,
  getBusinessRecordById,
} from '../models/business.model.js';

export const createBusiness = (payload) => createBusinessRecord(payload);

export const getAllBusinesses = () => getAllBusinessRecords();

export const getBusinessById = async (id) => {
  const business = await getBusinessRecordById(id);

  if (!business) {
    throw new ApiError(404, 'Business not found');
  }

  return business;
};
