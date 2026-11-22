import { z } from 'zod';
import { UUID_PATTERN } from '../schemas/common.schema.js';

const formatIssue = (issue) => issue.message || 'Validation failed';

export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse({
    body: req.body ?? {},
    params: req.params ?? {},
    query: req.query ?? {},
  });

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: formatIssue(result.error.issues[0]),
    });
  }

  if (result.data.body !== undefined) {
    req.body = result.data.body;
  }

  if (result.data.params !== undefined) {
    req.params = { ...req.params, ...result.data.params };
  }

  if (result.data.query !== undefined) {
    req.query = { ...req.query, ...result.data.query };
  }

  return next();
};

export const validateUuidParam = (req, res, next) => {
  const parsed = z
    .string()
    .trim()
    .regex(UUID_PATTERN, 'Invalid UUID format for id parameter')
    .safeParse(req.params.id);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Invalid UUID format for id parameter',
    });
  }

  req.params.id = parsed.data;
  return next();
};
