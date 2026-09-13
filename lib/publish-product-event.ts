import { internalApiHeaders } from "@/lib/internal-api-auth";

function getAppManagementAppUrl(): string {
  return (
    process.env.APP_MANAGEMENT_APP_URL?.replace(/\/$/, "") ||
    process.env.GOFAST_APP_MANAGEMENT_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_GOFAST_APP_MANAGEMENT_URL?.replace(/\/$/, "") ||
    "http://localhost:3020"
  );
}

export type ProductEventPayload = {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  athleteId?: string | null;
  companyId?: string | null;
  [key: string]: unknown;
};

/**
 * Publish a product event to App Management.
 * Never throws — signup and other flows must not fail because of downstream email.
 */
export function publishProductEvent(event: string, payload: ProductEventPayload): void {
  const url = `${getAppManagementAppUrl()}/api/events`;

  fetch(url, {
    method: "POST",
    headers: internalApiHeaders(),
    body: JSON.stringify({ event, payload }),
  }).catch((err) => {
    console.warn("[publish-product-event] failed:", event, err);
  });
}
