import { Router } from 'express';
import { createBranch, getAllBranches, getBranchById } from '../controllers/branch.controller.js';
import {
  createBusiness,
  getAllBusinesses,
  getBusinessById,
} from '../controllers/business.controller.js';
import { validate, validateUuidParam } from '../middlewares/validate.middleware.js';
import { createBranchSchema } from '../schemas/branch.schema.js';
import { createBusinessSchema } from '../schemas/business.schema.js';

const router = Router();

router.post('/businesses', validate(createBusinessSchema), createBusiness);
router.get('/businesses', getAllBusinesses);
router.get('/businesses/:id', validateUuidParam, getBusinessById);

router.post('/branches', validate(createBranchSchema), createBranch);
router.get('/branches', getAllBranches);
router.get('/branches/:id', validateUuidParam, getBranchById);

export default router;
