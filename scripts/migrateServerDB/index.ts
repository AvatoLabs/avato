import { join } from 'node:path';

import * as dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';
import { migrate as neonMigrate } from 'drizzle-orm/neon-serverless/migrator';
import { migrate as nodeMigrate } from 'drizzle-orm/node-postgres/migrator';

// @ts-ignore tsgo handle esm import cjs and compatibility issues
import { DB_FAIL_INIT_HINT, DUPLICATE_EMAIL_HINT, PGVECTOR_HINT } from './errorHint';

// Load environment variables (align with Next.js so `DATABASE_URL` in `.env.local` works):
// .env → .env.[NODE_ENV] → .env.local → .env.[NODE_ENV].local (each step overrides)
// https://nextjs.org/docs/app/building-your-application/configuring/environment-variables
const env = process.env.NODE_ENV || 'development';
dotenvExpand.expand(dotenv.config());
dotenvExpand.expand(dotenv.config({ override: true, path: `.env.${env}` }));
dotenvExpand.expand(dotenv.config({ override: true, path: '.env.local' }));
dotenvExpand.expand(dotenv.config({ override: true, path: `.env.${env}.local` }));

const migrationsFolder = join(__dirname, '../../packages/database/migrations');

const runMigrations = async () => {
  const { serverDB } = await import('../../packages/database/src/server');

  const time = Date.now();
  if (process.env.DATABASE_DRIVER === 'node') {
    await nodeMigrate(serverDB, { migrationsFolder });
  } else {
    await neonMigrate(serverDB, { migrationsFolder });
  }

  console.log('✅ database migration pass. use: %s ms', Date.now() - time);

  process.exit(0);
};

const connectionString = process.env.DATABASE_URL;

// only migrate database if the connection string is available
if (connectionString) {
  runMigrations().catch((err) => {
    console.error('❌ Database migrate failed:', err);

    const errMsg = err.message as string;

    const constraint = (err as { constraint?: string })?.constraint;

    if (errMsg.includes('extension "vector" is not available')) {
      console.info(PGVECTOR_HINT);
    } else if (constraint === 'users_email_unique' || errMsg.includes('users_email_unique')) {
      console.info(DUPLICATE_EMAIL_HINT);
    } else if (errMsg.includes(`Cannot read properties of undefined (reading 'migrate')`)) {
      console.info(DB_FAIL_INIT_HINT);
    }

    process.exit(1);
  });
} else {
  console.log('🟢 not find database env or in desktop mode, migration skipped');
}
