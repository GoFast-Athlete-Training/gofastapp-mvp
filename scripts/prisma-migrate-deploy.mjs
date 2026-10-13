/**
 * CI-safe `prisma migrate deploy` with Vercel/Neon advisory-lock mitigation.
 *
 * - Skips deploy when `migrate status` reports the DB is up to date (no advisory lock).
 * - Retries P1002 lock timeouts (concurrent builds / slow holders).
 * - On Vercel, final attempt uses PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK when retries exhaust.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

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

function runPrisma(args, extraEnv = {}) {
  return spawnSync('npx', ['prisma', ...args, '--schema', SCHEMA], {
    env: { ...process.env, ...extraEnv },
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

function sleep(ms) {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  spawnSync('sleep', [String(seconds)], { stdio: 'inherit' });
}

function main() {
  if (!process.env.DATABASE_URL) {
    console.error('prisma-migrate-deploy: DATABASE_URL is not set.');
    process.exit(1);
  }

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

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const useDisableLock =
      process.env.VERCEL === '1' &&
      attempt === MAX_ATTEMPTS &&
      process.env.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK !== '0';

    const extraEnv = useDisableLock ? { PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: '1' } : {};

    if (useDisableLock) {
      console.warn(
        'prisma-migrate-deploy: final attempt on Vercel with PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1',
      );
    }

    const deploy = runPrisma(['migrate', 'deploy'], extraEnv);
    process.stdout.write(deploy.stdout ?? '');
    process.stderr.write(deploy.stderr ?? '');

    if (deploy.status === 0) {
      process.exit(0);
    }

    if (isAdvisoryLockTimeout(deploy) && attempt < MAX_ATTEMPTS) {
      console.warn(
        `prisma-migrate-deploy: advisory lock timeout (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in ${RETRY_DELAY_MS / 1000}s…`,
      );
      sleep(RETRY_DELAY_MS);
      continue;
    }

    process.exit(deploy.status ?? 1);
  }
}

main();
