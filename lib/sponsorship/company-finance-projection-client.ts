export class CompanyFinanceProjectionError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable = true) {
    super(message);
    this.name = "CompanyFinanceProjectionError";
    this.retryable = retryable;
  }
}

function resolveCompanyAppUrl(): string {
  const base =
    process.env.GOFAST_COMPANY_APP_URL?.replace(/\/$/, "") ??
    process.env.GOFAST_COMPANY_API_URL?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_GOFAST_COMPANY_API_URL?.replace(/\/$/, "");
  if (!base) {
    throw new CompanyFinanceProjectionError("GOFAST_COMPANY_APP_URL is not configured", false);
  }
  return base;
}

/** Prod webhook follow-up: Company verifies payment by retrieving the Stripe event server-side. */
export async function projectPaidSponsorshipToCompany(stripeEventId: string): Promise<void> {
  const response = await fetch(`${resolveCompanyAppUrl()}/api/sponsorship/finance-projection`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ stripeEventId }),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
    retryable?: boolean;
  };

  if (!response.ok || !payload.success) {
    throw new CompanyFinanceProjectionError(
      payload.error ?? "Company finance projection failed",
      payload.retryable ?? response.status >= 500,
    );
  }
}
