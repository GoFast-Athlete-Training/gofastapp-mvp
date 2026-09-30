'use client';

import api from '@/lib/api';

function apiPath(url: string): string {
  if (url.startsWith('/api/')) return url.slice(4);
  if (url.startsWith('/api')) return url.slice(4) || '/';
  return url;
}

/** Run Manage UI uses athlete session (Firebase + x-athlete-id) like the main app. */
const runmanageApi = {
  async get(url: string) {
    return api.get(apiPath(url));
  },
  async post(url: string, data?: unknown) {
    return api.post(apiPath(url), data ?? {});
  },
  async put(url: string, data?: unknown) {
    return api.put(apiPath(url), data ?? {});
  },
  async patch(url: string, data?: unknown) {
    return api.patch(apiPath(url), data ?? {});
  },
  async delete(url: string) {
    return api.delete(apiPath(url));
  },
};

export default runmanageApi;
