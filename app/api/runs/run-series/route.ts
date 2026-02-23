/**
 * Alias for dashboard compatibility: GET/POST /api/runs/run-series
 * Same as /api/run-series (list) and /api/run-series/create (create).
 * GoFastCompany dashboard calls this path; product app also serves it so direct calls work.
 */
export const dynamic = 'force-dynamic';

export { GET } from '@/app/api/run-series/route';
export { POST } from '@/app/api/run-series/create/route';
