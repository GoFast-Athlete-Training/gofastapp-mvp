import { internalApiHeaders } from "@/lib/internal-api-auth";

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
  [key: string]: unknown;
};

/**
 * Notify Company stack of a product event (e.g. athlete.created).
 * Never throws — signup and other flows must not fail because of email.
 */
export function fireCompanyNotificationTrigger(
  event: string,
  payload: NotificationTriggerPayload
): void {
  const url = `${getCompanyAppUrl()}/api/notifications/trigger`;

  fetch(url, {
    method: "POST",
    headers: internalApiHeaders(),
    body: JSON.stringify({ event, payload }),
  }).catch((err) => {
    console.warn("[company-notification-trigger] failed:", event, err);
  });
}
