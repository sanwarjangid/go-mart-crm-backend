import { ApiError } from '../utils/ApiError.js';
import {
  createBranchRecord,
  findBranchByCode,
  getAllBranchRecords,
  getBranchRecordById,
  updateBranchRecord,
} from '../models/branch.model.js';

const canAccessAllBranches = (user) => user?.permissions?.includes('branches.access_all');

export const createBranch = async (payload) => {
  const existingBranch = await findBranchByCode(payload.branch_code);

  if (existingBranch) {
    throw new ApiError(409, 'Branch code already exists');
  }

  return createBranchRecord(payload);
};

export const getAllBranches = (user) => {
  if (canAccessAllBranches(user)) {
    return getAllBranchRecords();
  }

  return getAllBranchRecords(user.branch_ids);
};

export const getBranchById = async (id, user) => {
  const branch = await getBranchRecordById(id);

  if (!branch) {
    throw new ApiError(404, 'Branch not found');
  }

  if (!canAccessAllBranches(user) && !user.branch_ids.includes(Number(branch.id))) {
    throw new ApiError(403, 'You do not have access to this branch');
  }

  return branch;
};

export const updateBranch = async (id, payload, user) => {
  const current = await getBranchById(id, user);
  if (payload.branch_code && payload.branch_code !== current.branch_code) {
    const existingBranch = await findBranchByCode(payload.branch_code);
    if (existingBranch) {
      throw new ApiError(409, 'Branch code already exists');
    }
  }

  const data = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
  return updateBranchRecord(id, data);
};
