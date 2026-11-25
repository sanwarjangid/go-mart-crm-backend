import { ApiError } from '../utils/ApiError.js';
import {
  createRoleRecord,
  findPermissionsByIds,
  findRoleById,
  findRoleByName,
  listPermissions,
  listRoles,
  replaceRolePermissions,
  updateRoleRecord,
} from '../models/role.model.js';
import { shapeRole } from '../utils/userShape.js';

export const getRoles = async () => {
  const roles = await listRoles();
  return roles.map(shapeRole);
};

export const createRole = async (payload) => {
  const existing = await findRoleByName(payload.name);
  if (existing) {
    throw new ApiError(409, 'Role name already exists');
  }
  return shapeRole(await createRoleRecord(payload));
};

export const updateRole = async (id, payload) => {
  const role = await findRoleById(id);
  if (!role) {
    throw new ApiError(404, 'Role not found');
  }
  if (payload.name) {
    const existing = await findRoleByName(payload.name);
    if (existing && Number(existing.id) !== Number(id)) {
      throw new ApiError(409, 'Role name already exists');
    }
  }
  return shapeRole(await updateRoleRecord(id, payload));
};

export const getPermissions = () => listPermissions();

export const assignPermissions = async (id, permissionIds) => {
  const role = await findRoleById(id);
  if (!role) {
    throw new ApiError(404, 'Role not found');
  }

  if (permissionIds.length) {
    const permissions = await findPermissionsByIds(permissionIds);
    if (permissions.length !== permissionIds.length) {
      throw new ApiError(400, 'One or more permissions do not exist');
    }
  }

  await replaceRolePermissions(id, permissionIds);
  return shapeRole(await findRoleById(id));
};
