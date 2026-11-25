import * as authService from '../services/auth.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  return res.status(200).json(new ApiResponse(200, result, 'Login successful'));
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.getProfile(req.user.id);
  return res.status(200).json(new ApiResponse(200, user, 'Profile fetched successfully'));
});

export const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user.id, req.body);
  return res.status(200).json(new ApiResponse(200, null, 'Password changed successfully'));
});
