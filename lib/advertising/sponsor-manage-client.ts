export type AthleteSponsorshipEarnings = {
  source: "sponsorship_destination_charge";
  totalCreditedAthleteShareCents: number;
  creditedSponsorshipCount: number;
  payoutReady: boolean;
  connectState: string;
  label: string;
  detail: string;
};

function resolveSponsorManageUrl(): string | null {
  return (
    process.env.GOFAST_SPONSOR_MANAGE_URL?.replace(/\/$/, "") ??
    process.env.GOFAST_COMPANY_APP_URL?.replace(/\/$/, "") ??
    null
  );
}

export async function fetchAthleteSponsorshipEarningsFromSponsorManage(
  athleteId: string,
  authorization: string,
): Promise<AthleteSponsorshipEarnings | null> {
  const base = resolveSponsorManageUrl();
  if (!base) return null;

  try {
    const response = await fetch(
      `${base}/api/athlete-earnings/${encodeURIComponent(athleteId)}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: authorization.startsWith("Bearer ")
            ? authorization
            : `Bearer ${authorization}`,
          "x-athlete-id": athleteId,
        },
        cache: "no-store",
      },
    );
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      success?: boolean;
      earnings?: AthleteSponsorshipEarnings;
    };
    return payload.earnings ?? null;
  } catch (error) {
    console.warn("[sponsor-manage-client] athlete earnings failed", error);
    return null;
  }
}
