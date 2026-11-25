import bcrypt from 'bcryptjs';
import { ApiError } from '../utils/ApiError.js';
import { findBranchesByIds } from '../models/branch.model.js';
import { findRoleById } from '../models/role.model.js';
import {
  createUserRecord,
  findUserByEmail,
  findUserByEmployeeCode,
  findUserById,
  listUsers,
  replaceUserBranches,
  updateUserPassword,
  updateUserRecord,
} from '../models/user.model.js';
import { shapeUser } from '../utils/userShape.js';

const assertRole = async (roleId) => {
  const role = await findRoleById(roleId);
  if (!role || !role.is_active) {
    throw new ApiError(400, 'Role not found or inactive');
  }
  return role;
};

const assertBranches = async (branchIds) => {
  const branches = await findBranchesByIds(branchIds);
  if (branches.length !== branchIds.length) {
    throw new ApiError(400, 'One or more branches do not exist');
  }
  return branches;
};

const assertUniqueEmail = async (email, currentUserId) => {
  const existing = await findUserByEmail(email);
  if (existing && Number(existing.id) !== Number(currentUserId)) {
    throw new ApiError(409, 'Email already exists');
  }
};

const assertUniqueEmployeeCode = async (employeeCode, currentUserId) => {
  const existing = await findUserByEmployeeCode(employeeCode);
  if (existing && Number(existing.id) !== Number(currentUserId)) {
    throw new ApiError(409, 'Employee code already exists');
  }
};

export const createUser = async (payload) => {
  await assertRole(payload.role_id);
  await assertBranches(payload.branch_ids);
  await assertUniqueEmail(payload.email);
  await assertUniqueEmployeeCode(payload.employee_code);

  const password = await bcrypt.hash(payload.password, 12);
  const defaultBranchId = payload.default_branch_id || payload.branch_ids[0];

  const user = await createUserRecord({
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    employee_code: payload.employee_code,
    password,
    role_id: payload.role_id,
    default_branch_id: defaultBranchId,
    is_active: payload.is_active,
    user_branches: {
      create: payload.branch_ids.map((branchId) => ({ branch_id: branchId })),
    },
  });

  return shapeUser(user);
};

export const getUsers = async () => {
  const users = await listUsers();
  return users.map(shapeUser);
};

export const getUser = async (id) => {
  const user = shapeUser(await findUserById(id));
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  return user;
};

export const updateUser = async (id, payload) => {
  const current = await getUser(id);

  if (payload.role_id) {
    await assertRole(payload.role_id);
  }

  if (payload.email) {
    await assertUniqueEmail(payload.email, id);
  }

  if (payload.employee_code) {
    await assertUniqueEmployeeCode(payload.employee_code, id);
  }

  if (payload.default_branch_id) {
    if (!current.branch_ids.includes(payload.default_branch_id)) {
      throw new ApiError(400, 'default_branch_id must be a branch assigned to the user');
    }
  }

  const user = await updateUserRecord(id, payload);
  return shapeUser(user);
};

export const resetUserPassword = async (id, newPassword) => {
  await getUser(id);
  const password = await bcrypt.hash(newPassword, 12);
  await updateUserPassword(id, password);
};

export const updateUserStatus = async (id, isActive) => {
  await getUser(id);
  const user = await updateUserRecord(id, { is_active: isActive });
  return shapeUser(user);
};

export const assignBranches = async (id, { branch_ids, default_branch_id }) => {
  await getUser(id);
  await assertBranches(branch_ids);
  await replaceUserBranches(id, branch_ids);
  const user = await updateUserRecord(id, {
    default_branch_id: default_branch_id || branch_ids[0],
  });
  return shapeUser(user);
};
