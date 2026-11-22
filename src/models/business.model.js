import prisma from '../config/db.js';

export const createBusinessRecord = (data) => {
  return prisma.business.create({
    data,
  });
};

export const getAllBusinessRecords = () => {
  return prisma.business.findMany({
    include: {
      branches: true,
    },
    orderBy: {
      created_at: 'desc',
    },
  });
};

export const getBusinessRecordById = (id) => {
  return prisma.business.findUnique({
    where: { id },
    include: {
      branches: true,
    },
  });
};
