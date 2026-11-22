import * as branchService from '../services/branch.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const createBranch = asyncHandler(async (req, res) => {
  const branch = await branchService.createBranch(req.body);

  return res.status(201).json(new ApiResponse(201, branch, 'Branch created successfully'));
});

export const getAllBranches = asyncHandler(async (req, res) => {
  const branches = await branchService.getAllBranches();

  return res.status(200).json(new ApiResponse(200, branches, 'Branches fetched successfully'));
});

export const getBranchById = asyncHandler(async (req, res) => {
  const branch = await branchService.getBranchById(req.params.id);

  return res.status(200).json(new ApiResponse(200, branch, 'Branch fetched successfully'));
});
