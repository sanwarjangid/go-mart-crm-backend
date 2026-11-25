import { randomUUID } from 'node:crypto';
import { ApiError } from '../utils/ApiError.js';
import { assertBranchAccess } from '../utils/billing.js';
import { getBranchRecordById } from '../models/branch.model.js';
import {
  createCategoryRecord,
  createProductRecord,
  createTaxRateRecord,
  createUnitRecord,
  createVariantRecord,
  findProductByCode,
  findUnitBySymbol,
  findVariantByBarcode,
  findVariantBySku,
  getCategoryRecordById,
  getProductRecordById,
  getTaxRateRecordById,
  getUnitRecordById,
  getVariantRecordById,
  listBranchPriceRecords,
  listCategoryRecords,
  listProductRecords,
  listTaxRateRecords,
  listUnitRecords,
  listVariantRecords,
  updateCategoryRecord,
  updateProductRecord,
  updateTaxRateRecord,
  updateUnitRecord,
  updateVariantRecord,
  upsertBranchPriceRecord,
} from '../models/product.model.js';

const asNumber = (value) => (value == null ? value : Number(value));

const shapeTaxRate = (taxRate) => {
  if (!taxRate) {
    return taxRate;
  }
  return { ...taxRate, tax_percentage: asNumber(taxRate.tax_percentage) };
};

const shapeVariant = (variant) => ({
  ...variant,
  purchase_price: asNumber(variant.purchase_price),
  selling_price: asNumber(variant.selling_price),
  mrp: asNumber(variant.mrp),
});

const shapeProduct = (product) => ({
  ...product,
  variants: (product.variants || []).map(shapeVariant),
});

const shapeBranchPrice = (price) => ({
  ...price,
  purchase_price: asNumber(price.purchase_price),
  selling_price: asNumber(price.selling_price),
  mrp: asNumber(price.mrp),
  stock_quantity: asNumber(price.stock_quantity),
  tax_rate: shapeTaxRate(price.tax_rate),
});

const assertUnique = async (finder, value, currentId, message) => {
  if (!value) {
    return;
  }
  const existing = await finder(value);
  if (existing && Number(existing.id) !== Number(currentId)) {
    throw new ApiError(409, message);
  }
};

const assertCategoryParent = async (parentId, currentId) => {
  if (parentId == null) {
    return;
  }
  if (currentId && Number(parentId) === Number(currentId)) {
    throw new ApiError(400, 'Category cannot be its own parent');
  }

  let cursor = parentId;
  const seen = new Set();
  while (cursor) {
    const key = String(cursor);
    if (seen.has(key)) {
      break;
    }
    seen.add(key);
    if (currentId && Number(cursor) === Number(currentId)) {
      throw new ApiError(400, 'Category parent would create a cycle');
    }
    const parent = await getCategoryRecordById(cursor);
    if (!parent) {
      throw new ApiError(400, 'Parent category not found');
    }
    cursor = parent.parent_id;
  }
};

const assertProductRefs = async ({ category_id: categoryId, unit_id: unitId }) => {
  if (categoryId) {
    const category = await getCategoryRecordById(categoryId);
    if (!category) {
      throw new ApiError(400, 'Category not found');
    }
  }
  if (unitId) {
    const unit = await getUnitRecordById(unitId);
    if (!unit) {
      throw new ApiError(400, 'Unit not found');
    }
  }
};

export const createUnit = async (payload) => {
  await assertUnique(findUnitBySymbol, payload.unit_symbol, null, 'Unit symbol already exists');
  return createUnitRecord(payload);
};

export const getUnits = () => listUnitRecords();

export const getUnit = async (id) => {
  const unit = await getUnitRecordById(id);
  if (!unit) {
    throw new ApiError(404, 'Unit not found');
  }
  return unit;
};

export const updateUnit = async (id, payload) => {
  await getUnit(id);
  await assertUnique(findUnitBySymbol, payload.unit_symbol, id, 'Unit symbol already exists');
  return updateUnitRecord(id, payload);
};

export const createTaxRate = async (payload) => shapeTaxRate(await createTaxRateRecord(payload));

export const getTaxRates = async () => (await listTaxRateRecords()).map(shapeTaxRate);

export const getTaxRate = async (id) => {
  const taxRate = await getTaxRateRecordById(id);
  if (!taxRate) {
    throw new ApiError(404, 'Tax rate not found');
  }
  return shapeTaxRate(taxRate);
};

export const updateTaxRate = async (id, payload) => {
  await getTaxRate(id);
  return shapeTaxRate(await updateTaxRateRecord(id, payload));
};

export const createCategory = async (payload) => {
  await assertCategoryParent(payload.parent_id);
  return createCategoryRecord(payload);
};

export const getCategories = () => listCategoryRecords();

export const getCategory = async (id) => {
  const category = await getCategoryRecordById(id);
  if (!category) {
    throw new ApiError(404, 'Category not found');
  }
  return category;
};

export const updateCategory = async (id, payload) => {
  await getCategory(id);
  if (payload.parent_id !== undefined) {
    await assertCategoryParent(payload.parent_id, id);
  }
  return updateCategoryRecord(id, payload);
};

const withGeneratedProductCode = async (product) => {
  if (product.product_code) {
    return product;
  }
  const productCode = `PRD${String(product.id).padStart(6, '0')}`;
  return updateProductRecord(product.id, { product_code: productCode });
};

export const createProduct = async (payload) => {
  await assertUnique(findProductByCode, payload.product_code, null, 'Product code already exists');
  await assertProductRefs(payload);
  const product = await createProductRecord(payload);
  return shapeProduct(await withGeneratedProductCode(product));
};

export const getProducts = async (query) => {
  const products = await listProductRecords({
    search: query.search,
    categoryId: query.category_id,
    isActive: query.is_active === undefined ? undefined : query.is_active === 'true',
  });
  return products.map(shapeProduct);
};

export const getProduct = async (id) => {
  const product = await getProductRecordById(id);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }
  return shapeProduct(product);
};

export const updateProduct = async (id, payload) => {
  await getProduct(id);
  await assertUnique(findProductByCode, payload.product_code, id, 'Product code already exists');
  await assertProductRefs(payload);
  return shapeProduct(await updateProductRecord(id, payload));
};

const withGeneratedSku = async (variant, skuWasProvided) => {
  if (skuWasProvided) {
    return variant;
  }
  return updateVariantRecord(variant.id, { sku: `SKU${String(variant.id).padStart(6, '0')}` });
};

export const createVariant = async (productId, payload) => {
  await getProduct(productId);
  await assertUnique(findVariantBySku, payload.sku, null, 'SKU already exists');
  await assertUnique(findVariantByBarcode, payload.barcode, null, 'Barcode already exists');
  const skuWasProvided = Boolean(payload.sku);
  const variant = await createVariantRecord({
    ...payload,
    product_id: BigInt(productId),
    sku: payload.sku || `TMP-${randomUUID()}`,
  });
  return shapeVariant(await withGeneratedSku(variant, skuWasProvided));
};

export const getVariants = async (productId) => {
  await getProduct(productId);
  return (await listVariantRecords(productId)).map(shapeVariant);
};

export const getVariant = async (id) => {
  const variant = await getVariantRecordById(id);
  if (!variant) {
    throw new ApiError(404, 'Product variant not found');
  }
  return shapeVariant(variant);
};

export const updateVariant = async (id, payload) => {
  await getVariant(id);
  await assertUnique(findVariantBySku, payload.sku, id, 'SKU already exists');
  await assertUnique(findVariantByBarcode, payload.barcode, id, 'Barcode already exists');
  return shapeVariant(await updateVariantRecord(id, payload));
};

export const getBranchPrices = async (query, user) => {
  if (query.branch_id) {
    assertBranchAccess(user, query.branch_id);
  }
  const prices = await listBranchPriceRecords({
    branchId: query.branch_id,
    productVariantId: query.product_variant_id,
  });
  return prices.map(shapeBranchPrice);
};

export const saveBranchPrice = async (payload, user) => {
  assertBranchAccess(user, payload.branch_id);
  const branch = await getBranchRecordById(payload.branch_id);
  if (!branch) {
    throw new ApiError(400, 'Branch not found');
  }
  await getVariant(payload.product_variant_id);
  if (payload.tax_rate_id) {
    const taxRate = await getTaxRateRecordById(payload.tax_rate_id);
    if (!taxRate) {
      throw new ApiError(400, 'Tax rate not found');
    }
  }

  const data = {
    purchase_price: payload.purchase_price,
    selling_price: payload.selling_price,
    mrp: payload.mrp,
    tax_rate_id: payload.tax_rate_id,
  };
  if (payload.stock_quantity !== undefined) {
    data.stock_quantity = payload.stock_quantity;
  }

  const price = await upsertBranchPriceRecord({
    branchId: payload.branch_id,
    productVariantId: payload.product_variant_id,
    create: {
      ...data,
      stock_quantity: payload.stock_quantity ?? 0,
      branch_id: BigInt(payload.branch_id),
      product_variant_id: BigInt(payload.product_variant_id),
    },
    update: data,
  });
  return shapeBranchPrice(price);
};
