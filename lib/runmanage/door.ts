import { isRunManageHostname } from '@/lib/product-host';

export { isRunManageHostname };

export const RUN_MANAGE_WELCOME_PATH = '/welcome-runmanage';
export const RUN_MANAGE_DASHBOARD_PATH = '/runmanage/runs';
export const RUN_MANAGE_PUBLIC_ORIGIN = 'https://runmanage.gofastcrushgoals.com';

export function runManageWelcomePath(): string {
  return RUN_MANAGE_WELCOME_PATH;
}

export function runManageSignInPath(): string {
  const redirect = encodeURIComponent(runManageWelcomePath());
  return `/signup?mode=run-manage&auth=signin&redirect=${redirect}`;
}

export function runManageSignInUrl(base?: string): string {
  const origin = (base ?? RUN_MANAGE_PUBLIC_ORIGIN).replace(/\/$/, '');
  return `${origin}${runManageSignInPath()}`;
}

export function isRunManageRedirectPath(path: string | null | undefined): boolean {
  const p = path?.trim() ?? '';
  if (!p.startsWith('/')) return false;
  return p === RUN_MANAGE_WELCOME_PATH || p.startsWith('/runmanage');
}

export function isRunManageDoorContext(opts: {
  mode?: string | null;
  redirect?: string | null;
  hostname?: string | null;
}): boolean {
  if (opts.mode === 'run-manage') return true;
  if (isRunManageRedirectPath(opts.redirect)) return true;
  if (opts.hostname && isRunManageHostname(opts.hostname)) return true;
  return false;
}
