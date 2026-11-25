import prisma from '../config/db.js';

const toId = (id) => BigInt(id);

const roleSelect = {
  id: true,
  name: true,
  description: true,
  is_active: true,
  created_at: true,
  updated_at: true,
  role_permissions: {
    select: {
      permission: {
        select: {
          id: true,
          name: true,
          permission_key: true,
          module: true,
        },
      },
    },
  },
};

export const listRoles = () => {
  return prisma.role.findMany({
    select: roleSelect,
    orderBy: { id: 'asc' },
  });
};

export const findRoleById = (id) => {
  return prisma.role.findUnique({
    where: { id: toId(id) },
    select: roleSelect,
  });
};

export const findRoleByName = (name) => {
  return prisma.role.findUnique({
    where: { name },
  });
};

export const createRoleRecord = (data) => {
  return prisma.role.create({
    data,
    select: roleSelect,
  });
};

export const updateRoleRecord = (id, data) => {
  return prisma.role.update({
    where: { id: toId(id) },
    data,
    select: roleSelect,
  });
};

export const replaceRolePermissions = (roleId, permissionIds) => {
  const id = toId(roleId);
  return prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { role_id: id } }),
    prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({
        role_id: id,
        permission_id: toId(permissionId),
      })),
    }),
  ]);
};

export const listPermissions = () => {
  return prisma.permission.findMany({
    orderBy: [{ module: 'asc' }, { permission_key: 'asc' }],
  });
};

export const findPermissionsByIds = (ids) => {
  return prisma.permission.findMany({
    where: { id: { in: ids.map(toId) } },
  });
};

export const countPermissions = () => prisma.permission.count();

export const createPermissionRecord = (data) => prisma.permission.create({ data });
