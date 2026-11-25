import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { env } from './env.js';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, '../..');

const adapter = new PrismaMariaDb({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.name,
});

const prisma = new PrismaClient({ adapter });

export const runMigrations = async () => {
  const prismaCliPath = require.resolve('prisma/build/index.js');
  const { stdout } = await execFileAsync(process.execPath, [prismaCliPath, 'migrate', 'deploy'], {
    cwd: projectRoot,
    env: process.env,
  });
  if (stdout && stdout.trim()) {
    console.log(stdout.trim());
  }
};

export const connectDB = async () => {
  await prisma.$connect();
};

export default prisma;
