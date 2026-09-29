import type { NextRequest } from "next/server";
import { getCompanyAppUrl } from "@/lib/app-urls";

/** Server-side forward to GoFastCompany with the caller's Firebase Bearer. */
export async function forwardToCompany(
  request: NextRequest,
  companyPath: string,
  init?: RequestInit
): Promise<Response> {
  const base = getCompanyAppUrl();
  const path = companyPath.startsWith("/") ? companyPath : `/${companyPath}`;
  const url = `${base}${path}`;

  const headers = new Headers(init?.headers);
  const auth = request.headers.get("authorization");
  if (auth) {
    headers.set("Authorization", auth);
  }
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, {
    ...init,
    method: init?.method ?? request.method,
    headers,
    cache: "no-store",
  });
}
