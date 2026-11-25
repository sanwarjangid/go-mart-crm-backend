import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { findUserByEmail, findUserById, findUserPasswordById, updateUserPassword, updateUserRecord } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { shapeUser } from '../utils/userShape.js';

const signToken = (userId) =>
  jwt.sign({ user_id: userId }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

export const login = async ({ email, password }) => {
  const user = await findUserByEmail(email);

  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const passwordMatches = await bcrypt.compare(password, user.password);

  if (!passwordMatches) {
    throw new ApiError(401, 'Invalid email or password');
  }

  if (!user.is_active) {
    throw new ApiError(403, 'User account is inactive');
  }

  const profile = shapeUser(await updateUserRecord(user.id, { last_login: new Date() }));

  if (!profile.role?.is_active) {
    throw new ApiError(403, 'User role is inactive');
  }

  return {
    token: signToken(Number(user.id)),
    user: profile,
  };
};

export const getProfile = async (userId) => {
  const user = shapeUser(await findUserById(userId));

  if (!user) {
    throw new ApiError(401, 'User not found');
  }

  return user;
};

export const changePassword = async (userId, { current_password, new_password }) => {
  const user = await findUserPasswordById(userId);

  if (!user || !user.is_active) {
    throw new ApiError(401, 'User not found');
  }

  const passwordMatches = await bcrypt.compare(current_password, user.password);

  if (!passwordMatches) {
    throw new ApiError(400, 'Current password is incorrect');
  }

  const password = await bcrypt.hash(new_password, 12);
  await updateUserPassword(userId, password);
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, env.jwtSecret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Token has expired');
    }
    throw new ApiError(401, 'Invalid token');
  }
};
