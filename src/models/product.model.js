import prisma from '../config/db.js';

const toId = (id) => BigInt(id);

const productInclude = {
  category: {
    select: {
      id: true,
      parent_id: true,
      category_name: true,
      is_active: true,
    },
  },
  unit: {
    select: {
      id: true,
      unit_name: true,
      unit_symbol: true,
      is_active: true,
    },
  },
  variants: {
    orderBy: { created_at: 'asc' },
  },
};

export const createUnitRecord = (data) => prisma.unit.create({ data });

export const listUnitRecords = () => prisma.unit.findMany({ orderBy: { unit_name: 'asc' } });

export const getUnitRecordById = (id) => prisma.unit.findUnique({ where: { id: toId(id) } });

export const findUnitBySymbol = (unitSymbol) => prisma.unit.findUnique({ where: { unit_symbol: unitSymbol } });

export const updateUnitRecord = (id, data) => prisma.unit.update({ where: { id: toId(id) }, data });

export const createTaxRateRecord = (data) => prisma.taxRate.create({ data });

export const listTaxRateRecords = () => prisma.taxRate.findMany({ orderBy: { tax_name: 'asc' } });

export const getTaxRateRecordById = (id) => prisma.taxRate.findUnique({ where: { id: toId(id) } });

export const updateTaxRateRecord = (id, data) => prisma.taxRate.update({ where: { id: toId(id) }, data });

export const createCategoryRecord = (data) => prisma.productCategory.create({ data });

export const listCategoryRecords = () => prisma.productCategory.findMany({ orderBy: { category_name: 'asc' } });

export const getCategoryRecordById = (id) => prisma.productCategory.findUnique({ where: { id: toId(id) } });

export const updateCategoryRecord = (id, data) => prisma.productCategory.update({ where: { id: toId(id) }, data });

export const createProductRecord = (data) => prisma.product.create({ data, include: productInclude });

export const listProductRecords = ({ search, categoryId, isActive }) => {
  return prisma.product.findMany({
    where: {
      category_id: categoryId ? toId(categoryId) : undefined,
      is_active: isActive,
      OR: search
        ? [
            { product_name: { contains: search } },
            { product_code: { contains: search } },
            { hsn_code: { contains: search } },
          ]
        : undefined,
    },
    include: productInclude,
    orderBy: { created_at: 'desc' },
  });
};

export const getProductRecordById = (id) => {
  return prisma.product.findUnique({
    where: { id: toId(id) },
    include: productInclude,
  });
};

export const findProductByCode = (productCode) => prisma.product.findUnique({ where: { product_code: productCode } });

export const updateProductRecord = (id, data) => {
  return prisma.product.update({
    where: { id: toId(id) },
    data,
    include: productInclude,
  });
};

export const createVariantRecord = (data) => prisma.productVariant.create({ data });

export const listVariantRecords = (productId) => {
  return prisma.productVariant.findMany({
    where: { product_id: toId(productId) },
    orderBy: { created_at: 'asc' },
  });
};

export const getVariantRecordById = (id) => prisma.productVariant.findUnique({ where: { id: toId(id) } });

export const findVariantBySku = (sku) => prisma.productVariant.findUnique({ where: { sku } });

export const findVariantByBarcode = (barcode) => prisma.productVariant.findUnique({ where: { barcode } });

export const updateVariantRecord = (id, data) => prisma.productVariant.update({ where: { id: toId(id) }, data });

export const listBranchPriceRecords = ({ branchId, productVariantId }) => {
  return prisma.branchProductPrice.findMany({
    where: {
      branch_id: branchId ? toId(branchId) : undefined,
      product_variant_id: productVariantId ? toId(productVariantId) : undefined,
    },
    include: {
      tax_rate: {
        select: {
          id: true,
          tax_name: true,
          tax_percentage: true,
          tax_type: true,
          is_active: true,
        },
      },
    },
    orderBy: { id: 'desc' },
  });
};

export const upsertBranchPriceRecord = ({ branchId, productVariantId, create, update }) => {
  return prisma.branchProductPrice.upsert({
    where: {
      branch_id_product_variant_id: {
        branch_id: toId(branchId),
        product_variant_id: toId(productVariantId),
      },
    },
    create,
    update,
    include: {
      tax_rate: {
        select: {
          id: true,
          tax_name: true,
          tax_percentage: true,
          tax_type: true,
          is_active: true,
        },
      },
    },
  });
};
