import prisma from '../config/db.js';

const toId = (id) => BigInt(id);

export const createBranchRecord = (data) => {
  return prisma.branch.create({ data });
};

export const getAllBranchRecords = (branchIds) => {
  return prisma.branch.findMany({
    where: branchIds ? { id: { in: branchIds.map(toId) } } : undefined,
    orderBy: { created_at: 'desc' },
  });
};

export const getBranchRecordById = (id) => {
  return prisma.branch.findUnique({
    where: { id: toId(id) },
  });
};

export const findBranchByCode = (branch_code) => {
  return prisma.branch.findUnique({
    where: { branch_code },
  });
};

export const updateBranchRecord = (id, data) => {
  return prisma.branch.update({
    where: { id: toId(id) },
    data,
  });
};

export const findBranchesByIds = (ids) => {
  return prisma.branch.findMany({
    where: { id: { in: ids.map(toId) } },
  });
};
