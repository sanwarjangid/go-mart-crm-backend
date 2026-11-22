import prisma from '../config/db.js';

export const createBranchRecord = (data) => {
  return prisma.branch.create({
    data,
    include: {
      business: true,
    },
  });
};

export const getAllBranchRecords = () => {
  return prisma.branch.findMany({
    include: {
      business: true,
    },
    orderBy: {
      created_at: 'desc',
    },
  });
};

export const getBranchRecordById = (id) => {
  return prisma.branch.findUnique({
    where: { id },
    include: {
      business: true,
    },
  });
};

export const findBranchByBusinessAndCode = (business_id, branch_code) => {
  return prisma.branch.findFirst({
    where: {
      business_id,
      branch_code,
    },
  });
};
