import { ApiError } from '../utils/ApiError.js';
import { findUserById } from '../models/user.model.js';
import { verifyToken } from '../services/auth.service.js';
import { shapeUser } from '../utils/userShape.js';

export const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new ApiError(401, 'Authentication token is required');
    }

    const payload = verifyToken(token);
    const user = shapeUser(await findUserById(payload.user_id));

    if (!user || !user.is_active) {
      throw new ApiError(401, 'User account is inactive or no longer exists');
    }

    if (!user.role?.is_active) {
      throw new ApiError(403, 'User role is inactive');
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
};

export const authorize = (...requiredPermissions) => (req, res, next) => {
  const granted = req.user?.permissions || [];
  const missing = requiredPermissions.filter((permission) => !granted.includes(permission));

  if (missing.length) {
    return next(new ApiError(403, 'You do not have permission to perform this action'));
  }

  return next();
};
