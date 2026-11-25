import { ApiError } from './ApiError.js';

export const canAccessAllBranches = (user) => user?.permissions?.includes('branches.access_all');

export const assertBranchAccess = (user, branchId) => {
  if (canAccessAllBranches(user)) {
    return;
  }
  if (!user?.branch_ids?.includes(Number(branchId))) {
    throw new ApiError(403, 'You do not have access to this branch');
  }
};

export const branchScope = (user, branchId) => {
  if (branchId) {
    assertBranchAccess(user, branchId);
    return BigInt(branchId);
  }
  if (canAccessAllBranches(user)) {
    return undefined;
  }
  return { in: (user.branch_ids || []).map((id) => BigInt(id)) };
};

const isDecimal = (value) =>
  value &&
  typeof value === 'object' &&
  typeof value.toFixed === 'function' &&
  !(value instanceof Date) &&
  !Array.isArray(value);

export const shapeRecord = (value) => {
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (isDecimal(value)) {
    return Number(value);
  }
  if (Array.isArray(value)) {
    return value.map(shapeRecord);
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shapeRecord(item)]));
  }
  return value;
};

export const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export const financialYear = (date) => {
  const year = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return `${year}-${String(year + 1).slice(-2)}`;
};

export const dayRange = (day) => {
  const start = new Date(`${day}T00:00:00`);
  const end = new Date(`${day}T23:59:59`);
  return { start, end };
};
