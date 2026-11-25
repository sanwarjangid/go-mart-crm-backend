import prisma from '../config/db.js';

const toId = (id) => BigInt(id);

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  employee_code: true,
  role_id: true,
  default_branch_id: true,
  is_active: true,
  last_login: true,
  created_at: true,
  updated_at: true,
  role: {
    select: {
      id: true,
      name: true,
      description: true,
      is_active: true,
      role_permissions: {
        select: {
          permission: {
            select: {
              permission_key: true,
            },
          },
        },
      },
    },
  },
  default_branch: {
    select: {
      id: true,
      branch_code: true,
      branch_name: true,
      is_active: true,
    },
  },
  user_branches: {
    select: {
      branch_id: true,
      branch: {
        select: {
          id: true,
          branch_code: true,
          branch_name: true,
          is_active: true,
        },
      },
    },
  },
};

export const findUserByEmail = (email) => {
  return prisma.user.findUnique({
    where: { email },
  });
};

export const findUserByEmployeeCode = (employeeCode) => {
  return prisma.user.findUnique({
    where: { employee_code: employeeCode },
  });
};

export const findUserById = (id) => {
  return prisma.user.findUnique({
    where: { id: toId(id) },
    select: publicUserSelect,
  });
};

export const listUsers = () => {
  return prisma.user.findMany({
    select: publicUserSelect,
    orderBy: { created_at: 'desc' },
  });
};

export const createUserRecord = (data) => {
  return prisma.user.create({
    data,
    select: publicUserSelect,
  });
};

export const updateUserRecord = (id, data) => {
  return prisma.user.update({
    where: { id: toId(id) },
    data,
    select: publicUserSelect,
  });
};

export const replaceUserBranches = (userId, branchIds) => {
  const id = toId(userId);
  return prisma.$transaction([
    prisma.userBranch.deleteMany({ where: { user_id: id } }),
    prisma.userBranch.createMany({
      data: branchIds.map((branchId) => ({
        user_id: id,
        branch_id: toId(branchId),
      })),
    }),
  ]);
};

export const findUserPasswordById = (id) => {
  return prisma.user.findUnique({
    where: { id: toId(id) },
    select: { id: true, password: true, is_active: true },
  });
};

export const updateUserPassword = (id, password) => {
  return prisma.user.update({
    where: { id: toId(id) },
    data: { password },
    select: { id: true },
  });
};
