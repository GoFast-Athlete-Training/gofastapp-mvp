import { internalApiHeaders } from "@/lib/internal-api-auth";
import { prisma } from "@/lib/prisma";
import { athletePresetInclude } from "@/lib/training/plan-generate-presets-loader";
import { serializeAthletePresetForApi } from "@/lib/training/athlete-preset-blueprint";

function trainingManageBaseUrl(): string | null {
  const base =
    process.env.GOFAST_TRAINING_MANAGE_URL?.trim() ||
    process.env.NEXT_PUBLIC_GOFAST_TRAINING_MANAGE_URL?.trim();
  return base ? base.replace(/\/$/, "") : null;
}

/** Reverse-write athlete-owned blueprint to Training Manage (machine lane). */
export async function syncAthletePresetToTrainingManage(athletePresetId: string): Promise<void> {
  const base = trainingManageBaseUrl();
  if (!base) return;

  const row = await prisma.athlete_presets.findUnique({
    where: { id: athletePresetId },
    include: athletePresetInclude,
  });
  if (!row) return;

  const payload = serializeAthletePresetForApi(row);

  const res = await fetch(`${base}/api/internal/athlete-preset/import`, {
    method: "POST",
    headers: {
      ...internalApiHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ athletePreset: payload }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Training Manage athlete preset import failed (${res.status}): ${text.slice(0, 200)}`);
  }
}
