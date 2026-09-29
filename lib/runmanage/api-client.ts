"use client";

import axios from "axios";
import { auth } from "@/lib/firebase";
import { STAFF_ID_KEY } from "@/lib/runmanage/staff-session";
import { STAFF_ID_HEADER } from "@/lib/training/training-engine-auth";

const runmanageClient = axios.create({
  baseURL: "",
  headers: { "Content-Type": "application/json" },
});

runmanageClient.interceptors.request.use(
  async (config) => {
    try {
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken(false).catch(async () => user.getIdToken(true));
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // unauthenticated request
    }
    if (typeof window !== "undefined") {
      const staffId = localStorage.getItem(STAFF_ID_KEY);
      if (staffId) {
        config.headers[STAFF_ID_HEADER] = staffId;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

const runmanageApi = {
  get: async (url: string) => {
    const response = await runmanageClient.get(url);
    return { data: response.data };
  },
  post: async (url: string, data?: unknown) => {
    const response = await runmanageClient.post(url, data ?? {});
    return { data: response.data };
  },
  put: async (url: string, data?: unknown) => {
    const response = await runmanageClient.put(url, data ?? {});
    return { data: response.data };
  },
  patch: async (url: string, data?: unknown) => {
    const response = await runmanageClient.patch(url, data ?? {});
    return { data: response.data };
  },
  delete: async (url: string) => {
    const response = await runmanageClient.delete(url);
    return { data: response.data };
  },
};

export default runmanageApi;
