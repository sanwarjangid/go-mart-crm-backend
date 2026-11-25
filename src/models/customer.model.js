import prisma from '../config/db.js';

const toId = (id) => BigInt(id);

export const createCustomerRecord = (data) => prisma.customer.create({ data });

export const listCustomerRecords = (search) => {
  return prisma.customer.findMany({
    where: search
      ? {
          OR: [
            { customer_name: { contains: search } },
            { phone: { contains: search } },
            { customer_code: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : undefined,
    orderBy: { created_at: 'desc' },
  });
};

export const getCustomerRecordById = (id) => {
  return prisma.customer.findUnique({ where: { id: toId(id) } });
};

export const findCustomerByCode = (customerCode) => {
  return prisma.customer.findUnique({ where: { customer_code: customerCode } });
};

export const updateCustomerRecord = (id, data) => {
  return prisma.customer.update({
    where: { id: toId(id) },
    data,
  });
};
