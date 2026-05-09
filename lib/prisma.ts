import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Neon pooled hosts need explicit query params for Prisma + PgBouncer (transaction mode)
 * and for compute wake time. Without them, cold starts often surface as
 * "Can't reach database server" (P1001) even when the project is healthy.
 *
 * @see https://www.prisma.io/docs/guides/database/neon
 */
function withRecommendedNeonDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw || !raw.includes('neon.tech')) {
    return raw;
  }
  try {
    const u = new URL(raw);
    const isPooler = u.hostname.includes('-pooler');
    const q = u.searchParams;
    if (isPooler && !q.has('pgbouncer')) {
      q.set('pgbouncer', 'true');
    }
    if (!q.has('connection_limit')) {
      q.set('connection_limit', '1');
    }
    const ct = Number(q.get('connect_timeout'));
    if (!Number.isFinite(ct) || ct < 15) {
      q.set('connect_timeout', '30');
    }
    if (!q.has('sslmode')) {
      q.set('sslmode', 'require');
    }
    return u.toString();
  } catch {
    return raw;
  }
}

const databaseUrl =
  withRecommendedNeonDatabaseUrl(process.env.DATABASE_URL) ?? process.env.DATABASE_URL;

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = new PrismaClient(
    databaseUrl
      ? {
          datasources: {
            db: { url: databaseUrl },
          },
        }
      : undefined
  );
}

export const prisma = globalForPrisma.prisma;

export default prisma;
