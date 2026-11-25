import * as productService from '../services/product.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const created = (res, data, message) => res.status(201).json(new ApiResponse(201, data, message));
const ok = (res, data, message) => res.status(200).json(new ApiResponse(200, data, message));

export const createUnit = asyncHandler(async (req, res) => {
  return created(res, await productService.createUnit(req.body), 'Unit created successfully');
});

export const getUnits = asyncHandler(async (req, res) => {
  return ok(res, await productService.getUnits(), 'Units fetched successfully');
});

export const getUnit = asyncHandler(async (req, res) => {
  return ok(res, await productService.getUnit(req.params.id), 'Unit fetched successfully');
});

export const updateUnit = asyncHandler(async (req, res) => {
  return ok(res, await productService.updateUnit(req.params.id, req.body), 'Unit updated successfully');
});

export const createTaxRate = asyncHandler(async (req, res) => {
  return created(res, await productService.createTaxRate(req.body), 'Tax rate created successfully');
});

export const getTaxRates = asyncHandler(async (req, res) => {
  return ok(res, await productService.getTaxRates(), 'Tax rates fetched successfully');
});

export const getTaxRate = asyncHandler(async (req, res) => {
  return ok(res, await productService.getTaxRate(req.params.id), 'Tax rate fetched successfully');
});

export const updateTaxRate = asyncHandler(async (req, res) => {
  return ok(res, await productService.updateTaxRate(req.params.id, req.body), 'Tax rate updated successfully');
});

export const createCategory = asyncHandler(async (req, res) => {
  return created(res, await productService.createCategory(req.body), 'Category created successfully');
});

export const getCategories = asyncHandler(async (req, res) => {
  return ok(res, await productService.getCategories(), 'Categories fetched successfully');
});

export const getCategory = asyncHandler(async (req, res) => {
  return ok(res, await productService.getCategory(req.params.id), 'Category fetched successfully');
});

export const updateCategory = asyncHandler(async (req, res) => {
  return ok(res, await productService.updateCategory(req.params.id, req.body), 'Category updated successfully');
});

export const createProduct = asyncHandler(async (req, res) => {
  return created(res, await productService.createProduct(req.body), 'Product created successfully');
});

export const getProducts = asyncHandler(async (req, res) => {
  return ok(res, await productService.getProducts(req.query), 'Products fetched successfully');
});

export const getProduct = asyncHandler(async (req, res) => {
  return ok(res, await productService.getProduct(req.params.id), 'Product fetched successfully');
});

export const updateProduct = asyncHandler(async (req, res) => {
  return ok(res, await productService.updateProduct(req.params.id, req.body), 'Product updated successfully');
});

export const createVariant = asyncHandler(async (req, res) => {
  return created(res, await productService.createVariant(req.params.id, req.body), 'Product variant created successfully');
});

export const getVariants = asyncHandler(async (req, res) => {
  return ok(res, await productService.getVariants(req.params.id), 'Product variants fetched successfully');
});

export const updateVariant = asyncHandler(async (req, res) => {
  return ok(res, await productService.updateVariant(req.params.id, req.body), 'Product variant updated successfully');
});

export const getBranchPrices = asyncHandler(async (req, res) => {
  return ok(res, await productService.getBranchPrices(req.query, req.user), 'Branch prices fetched successfully');
});

export const saveBranchPrice = asyncHandler(async (req, res) => {
  return ok(res, await productService.saveBranchPrice(req.body, req.user), 'Branch price saved successfully');
});
