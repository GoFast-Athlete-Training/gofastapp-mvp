/**
 * CI-safe `prisma migrate deploy` with Vercel/Neon advisory-lock mitigation.
 *
 * - Uses unpooled DATABASE_URL when available (Neon migrate best practice).
 * - Clears failed migrations from other repos on the shared DB (not in this prisma/migrations).
 * - Skips deploy when `migrate status` reports the DB is up to date (no advisory lock).
 * - Retries P1002 lock timeouts (concurrent builds / slow holders).
 * - On Vercel, uses PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK after the first P1002.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const root = process.cwd();
parseEnvFile(path.join(root, '.env'));
parseEnvFile(path.join(root, '.env.local'));

const SCHEMA = './prisma/schema.prisma';
const MAX_ATTEMPTS = 8;
const RETRY_DELAY_MS = 15_000;

function migrateDatabaseUrl() {
  return (
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    process.env.POSTGRES_URL_NON_POOLING?.trim() ||
    process.env.DATABASE_URL
  );
}

function localMigrationNames() {
  const dir = path.join(root, 'prisma/migrations');
  if (!fs.existsSync(dir)) return new Set();
  return new Set(
    fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name),
  );
}

function runPrisma(args, extraEnv = {}) {
  const migrateUrl = migrateDatabaseUrl();
  return spawnSync('npx', ['prisma', ...args, '--schema', SCHEMA], {
    env: {
      ...process.env,
      DATABASE_URL: migrateUrl,
      ...extraEnv,
    },
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe'],
  });
}

function isUpToDateStatus(result) {
  const out = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  return out.includes('Database schema is up to date!');
}

function isAdvisoryLockTimeout(result) {
  const out = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  return out.includes('P1002') || out.includes('pg_advisory_lock');
}

function isFailedMigrationBlock(result) {
  const out = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  return out.includes('P3009') || out.includes('failed migrations in the target database');
}

function failedMigrationNameFromOutput(result) {
  const out = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const m = out.match(/The `([^`]+)` migration started at/m);
  return m?.[1] ?? null;
}

function sleep(ms) {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  spawnSync('sleep', [String(seconds)], { stdio: 'inherit' });
}

async function clearOrphanFailedMigrations() {
  const local = localMigrationNames();
  const migrateUrl = migrateDatabaseUrl();
  if (!migrateUrl) return;

  const prisma = new PrismaClient({
    datasources: { db: { url: migrateUrl } },
  });

  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT migration_name, finished_at, rolled_back_at
      FROM _prisma_migrations
      WHERE finished_at IS NULL AND rolled_back_at IS NULL
      ORDER BY started_at
    `);

    for (const row of rows) {
      const name = row.migration_name;
      if (local.has(name)) continue;
      console.warn(
        `prisma-migrate-deploy: orphan failed migration "${name}" (not in this repo) — marking rolled back`,
      );
      const resolve = runPrisma(['migrate', 'resolve', '--rolled-back', name]);
      process.stdout.write(resolve.stdout ?? '');
      process.stderr.write(resolve.stderr ?? '');
      if (resolve.status !== 0) {
        console.error(`prisma-migrate-deploy: could not resolve ${name}`);
        process.exit(resolve.status ?? 1);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const migrateUrl = migrateDatabaseUrl();
  if (!migrateUrl) {
    console.error('prisma-migrate-deploy: DATABASE_URL is not set.');
    process.exit(1);
  }

  if (migrateUrl !== process.env.DATABASE_URL) {
    console.log('prisma-migrate-deploy: using unpooled DATABASE_URL for migrate.');
  }

  await clearOrphanFailedMigrations();

  const status = runPrisma(['migrate', 'status']);
  if (status.status === 0 && isUpToDateStatus(status)) {
    console.log('prisma-migrate-deploy: schema up to date — skipping migrate deploy.');
    process.exit(0);
  }

  if (status.status !== 0) {
    process.stderr.write(status.stderr ?? '');
    process.stdout.write(status.stdout ?? '');
    console.warn('prisma-migrate-deploy: migrate status failed; attempting deploy anyway.');
  } else {
    console.log('prisma-migrate-deploy: pending migrations — running migrate deploy.');
  }

  let sawLockTimeout = false;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const useDisableLock =
      process.env.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK === '1' ||
      (process.env.VERCEL === '1' &&
        (sawLockTimeout || attempt >= MAX_ATTEMPTS) &&
        process.env.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK !== '0');

    const extraEnv = useDisableLock ? { PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: '1' } : {};

    if (useDisableLock && attempt > 1) {
      console.warn(
        'prisma-migrate-deploy: using PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1 for this attempt',
      );
    }

    const deploy = runPrisma(['migrate', 'deploy'], extraEnv);
    process.stdout.write(deploy.stdout ?? '');
    process.stderr.write(deploy.stderr ?? '');

    if (deploy.status === 0) {
      process.exit(0);
    }

    if (isFailedMigrationBlock(deploy)) {
      const failedName = failedMigrationNameFromOutput(deploy);
      const local = localMigrationNames();
      if (failedName && !local.has(failedName)) {
        console.warn(
          `prisma-migrate-deploy: P3009 on orphan "${failedName}" — resolving rolled back and retrying`,
        );
        const resolve = runPrisma(['migrate', 'resolve', '--rolled-back', failedName]);
        process.stdout.write(resolve.stdout ?? '');
        process.stderr.write(resolve.stderr ?? '');
        if (resolve.status === 0) {
          continue;
        }
      }
    }

    if (isAdvisoryLockTimeout(deploy)) {
      sawLockTimeout = true;
      if (attempt < MAX_ATTEMPTS) {
        console.warn(
          `prisma-migrate-deploy: advisory lock timeout (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in ${RETRY_DELAY_MS / 1000}s…`,
        );
        sleep(RETRY_DELAY_MS);
        continue;
      }
    }

    process.exit(deploy.status ?? 1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
