import app from './app.js';
import { env } from './config/env.js';
import prisma, { connectDB, runMigrations } from './config/db.js';

let server;

const startServer = async () => {
  if (env.hasDbConfig) {
    try {
      await runMigrations();
      await connectDB();
      console.log('Database connected');
    } catch (error) {
      const details = error.stderr || error.stdout || error.message;
      console.error('Startup failed during database migration or connection:', details);
      await prisma.$disconnect();
      process.exit(1);
    }
  }

  server = app.listen(env.port, '0.0.0.0', () => {
    console.log(`Server running on port ${env.port}`);
  });
};

const shutdown = async () => {
  if (server) {
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  } else {
    await prisma.$disconnect();
    process.exit(0);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

startServer();
