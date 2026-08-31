import { internalApiHeaders } from "@/lib/internal-api-auth";

function getAppManagementUrl(): string {
  return (
    process.env.GOFAST_APP_MANAGEMENT_URL?.replace(/\/$/, "") ||
    process.env.APP_MANAGEMENT_APP_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_GOFAST_APP_MANAGEMENT_URL?.replace(/\/$/, "") ||
    "http://localhost:3020"
  );
}

export async function resolveAcquisitionInvite(token: string) {
  const url = `${getAppManagementUrl()}/api/internal/acquisition/invite/${encodeURIComponent(token)}`;
  const response = await fetch(url, {
    headers: internalApiHeaders(),
    cache: "no-store",
  });
  return response.json();
}
