import { internalApiHeaders } from "@/lib/internal-api-auth";

function getAppManagementAppUrl(): string {
  return (
    process.env.APP_MANAGEMENT_APP_URL?.replace(/\/$/, "") ||
    process.env.GOFAST_APP_MANAGEMENT_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_GOFAST_APP_MANAGEMENT_URL?.replace(/\/$/, "") ||
    "http://localhost:3020"
  );
}

function getCompanyAppUrl(): string {
  return (
    process.env.COMPANY_APP_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_COMPANY_APP_URL?.replace(/\/$/, "") ||
    "https://gofasthq.gofastcrushgoals.com"
  );
}

export type NotificationTriggerPayload = {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  athleteId?: string | null;
  companyId?: string | null;
  [key: string]: unknown;
};

/**
 * Notify App Management (preferred) or Company fallback of a product event.
 * Never throws — signup and other flows must not fail because of email.
 */
export function fireCompanyNotificationTrigger(
  event: string,
  payload: NotificationTriggerPayload,
): void {
  const appMgmtConfigured = Boolean(process.env.GOFAST_APP_MANAGEMENT_URL?.trim());
  const baseUrl = appMgmtConfigured ? getAppManagementAppUrl() : getCompanyAppUrl();
  const url = `${baseUrl}/api/notifications/trigger`;

  fetch(url, {
    method: "POST",
    headers: internalApiHeaders(),
    body: JSON.stringify({ event, payload }),
  }).catch((err) => {
    console.warn("[company-notification-trigger] failed:", event, err);
  });
}
