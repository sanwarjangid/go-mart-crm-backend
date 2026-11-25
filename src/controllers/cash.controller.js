import * as cashService from '../services/cash.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getCounters = asyncHandler(async (req, res) => {
  const counters = await cashService.listCounters(req.user, req.query.branch_id);
  return res.status(200).json(new ApiResponse(200, counters, 'Counters fetched successfully'));
});

export const getCashShifts = asyncHandler(async (req, res) => {
  const shifts = await cashService.listCashShifts(req.user, req.query.branch_id);
  return res.status(200).json(new ApiResponse(200, shifts, 'Cash shifts fetched successfully'));
});

export const getCashShift = asyncHandler(async (req, res) => {
  const shift = await cashService.getCashShift(req.user, req.params.id);
  return res.status(200).json(new ApiResponse(200, shift, 'Cash shift fetched successfully'));
});

export const openCashShift = asyncHandler(async (req, res) => {
  const shift = await cashService.openCashShift(req.user, req.body);
  const joined = shift.cashiers?.length > 1;
  return res.status(201).json(new ApiResponse(201, shift, joined ? 'Joined the open counter shift' : 'Cash shift started'));
});

export const addCashMovement = asyncHandler(async (req, res) => {
  const shift = await cashService.addCashMovement(req.user, req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, shift, 'Counter cash updated'));
});

export const closeCashShift = asyncHandler(async (req, res) => {
  const shift = await cashService.closeCashShift(req.user, req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, shift, 'Cash shift closed'));
});
