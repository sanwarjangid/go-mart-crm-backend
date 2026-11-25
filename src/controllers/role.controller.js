import * as roleService from '../services/role.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getRoles = asyncHandler(async (req, res) => {
  const roles = await roleService.getRoles();
  return res.status(200).json(new ApiResponse(200, roles, 'Roles fetched successfully'));
});

export const createRole = asyncHandler(async (req, res) => {
  const role = await roleService.createRole(req.body);
  return res.status(201).json(new ApiResponse(201, role, 'Role created successfully'));
});

export const updateRole = asyncHandler(async (req, res) => {
  const role = await roleService.updateRole(req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, role, 'Role updated successfully'));
});

export const getPermissions = asyncHandler(async (req, res) => {
  const permissions = await roleService.getPermissions();
  return res.status(200).json(new ApiResponse(200, permissions, 'Permissions fetched successfully'));
});

export const assignPermissions = asyncHandler(async (req, res) => {
  const role = await roleService.assignPermissions(req.params.id, req.body.permission_ids);
  return res.status(200).json(new ApiResponse(200, role, 'Permissions assigned successfully'));
});
