import dotenv from 'dotenv';

dotenv.config();

const db = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD ?? '',
  name: process.env.DB_NAME || 'gocart_erp',
};

export const buildDatabaseUrl = (config = db) => {
  const user = encodeURIComponent(config.user);
  const password = config.password ? encodeURIComponent(config.password) : '';
  const credentials = config.password ? `${user}:${password}` : user;
  const database = encodeURIComponent(config.name);
  return `mysql://${credentials}@${config.host}:${config.port}/${database}`;
};

export const env = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'change-this-jwt-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  db,
  hasDbConfig: Boolean(process.env.DB_HOST || process.env.DB_USER || process.env.DB_NAME),
};
