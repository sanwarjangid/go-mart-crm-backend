import * as userService from '../services/user.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const createUser = asyncHandler(async (req, res) => {
  const user = await userService.createUser(req.body);
  return res.status(201).json(new ApiResponse(201, user, 'User created successfully'));
});

export const getUsers = asyncHandler(async (req, res) => {
  const users = await userService.getUsers();
  return res.status(200).json(new ApiResponse(200, users, 'Users fetched successfully'));
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await userService.getUser(req.params.id);
  return res.status(200).json(new ApiResponse(200, user, 'User fetched successfully'));
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, user, 'User updated successfully'));
});

export const resetUserPassword = asyncHandler(async (req, res) => {
  await userService.resetUserPassword(req.params.id, req.body.password);
  return res.status(200).json(new ApiResponse(200, null, 'Password reset successfully'));
});

export const updateUserStatus = asyncHandler(async (req, res) => {
  const user = await userService.updateUserStatus(req.params.id, req.body.is_active);
  return res.status(200).json(new ApiResponse(200, user, 'User status updated successfully'));
});

export const assignBranches = asyncHandler(async (req, res) => {
  const user = await userService.assignBranches(req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, user, 'Branches assigned successfully'));
});
