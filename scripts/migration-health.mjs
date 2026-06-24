/**
 * Read-only migration health check for gofastapp-mvp.
 *
 * Fails when _prisma_migrations contains a failed migration that was not rolled back.
 * The known legacy row `20241214220000_add_planning_days_to_weeks` is allowed only when
 * rolled_back_at IS NOT NULL and applied_steps_count = 0 (pre-baseline archive drift).
 */

import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const LEGACY_ROLLED_BACK_NAME = '20241214220000_add_planning_days_to_weeks';

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

function isKnownSafeLegacyRow(row) {
  return (
    row.migration_name === LEGACY_ROLLED_BACK_NAME &&
    row.rolled_back_at != null &&
    Number(row.applied_steps_count) === 0 &&
    row.finished_at == null
  );
}

function isBlockingFailedRow(row) {
  if (row.finished_at != null) return false;
  if (isKnownSafeLegacyRow(row)) return false;
  // Unfinished and not safely rolled back
  if (row.rolled_back_at != null) return false;
  return true;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('migration-health: DATABASE_URL is not set (.env / .env.local).');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT migration_name, applied_steps_count, finished_at, rolled_back_at
      FROM _prisma_migrations
      ORDER BY started_at
    `);

    const blocking = rows.filter(isBlockingFailedRow);
    const legacySafe = rows.filter(isKnownSafeLegacyRow);

    if (blocking.length > 0) {
      console.error('migration-health: FAILED — unresolved migration(s) in _prisma_migrations:\n');
      for (const row of blocking) {
        console.error(`  - ${row.migration_name} (not finished, not rolled back)`);
      }
      console.error(
        '\nResolve with prisma migrate resolve (see docs/MIGRATION_WORKFLOW.md). Do not run migrate reset on shared DBs.'
      );
      process.exit(1);
    }

    console.log('migration-health: OK');
    console.log(`  Applied / finished migrations: ${rows.filter((r) => r.finished_at != null).length}`);
    if (legacySafe.length > 0) {
      console.log(
        `  Known safe legacy row: ${LEGACY_ROLLED_BACK_NAME} (rolled back, pre-baseline archive — ignored)`
      );
    }
    process.exit(0);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('migration-health:', e instanceof Error ? e.message : e);
  process.exit(1);
});
