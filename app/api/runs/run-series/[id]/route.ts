/**
 * Alias for dashboard compatibility: GET/PUT /api/runs/run-series/[id]
 * Same as /api/run-series/[id].
 */
export const dynamic = 'force-dynamic';

export { GET, PUT } from '@/app/api/run-series/[id]/route';
