import { ApiError } from '../utils/ApiError.js';
import { getBusinessRecordById } from '../models/business.model.js';
import {
  createBranchRecord,
  findBranchByBusinessAndCode,
  getAllBranchRecords,
  getBranchRecordById,
} from '../models/branch.model.js';

export const createBranch = async (payload) => {
  const business = await getBusinessRecordById(payload.business_id);

  if (!business) {
    throw new ApiError(404, 'Business not found. Every branch must belong to an existing business.');
  }

  const existingBranch = await findBranchByBusinessAndCode(payload.business_id, payload.branch_code);

  if (existingBranch) {
    throw new ApiError(409, 'Branch code already exists for this business');
  }

  return createBranchRecord(payload);
};

export const getAllBranches = () => getAllBranchRecords();

export const getBranchById = async (id) => {
  const branch = await getBranchRecordById(id);

  if (!branch) {
    throw new ApiError(404, 'Branch not found');
  }

  return branch;
};
