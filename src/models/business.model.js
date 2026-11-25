import prisma from '../config/db.js';

const toId = (id) => BigInt(id);

export const createBusinessRecord = (data) => {
  return prisma.business.create({
    data,
  });
};

export const getAllBusinessRecords = () => {
  return prisma.business.findMany({
    orderBy: {
      created_at: 'desc',
    },
  });
};

export const getBusinessRecordById = (id) => {
  return prisma.business.findUnique({
    where: { id: toId(id) },
  });
};
