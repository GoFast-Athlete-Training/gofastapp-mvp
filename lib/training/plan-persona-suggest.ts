import type { AthletePersonaCapability, TrainingPlanGoalKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildPersonaSlug,
  capabilityToSlugPrefix,
  normalizeSlug,
} from "@/lib/training/plan-entity-slugs";
import { findPersonaBySlug } from "@/lib/training/plan-persona-goal";
import { serializePlanPersona, type PlanPersonaApi } from "@/lib/training/plan-entity-serialize";

const CAPABILITY_LABEL: Record<string, string> = {
  NON_RUNNER: "Non-runner",
  BEGINNER: "Beginner",
  RECREATIONAL: "Recreational",
  COMPETITIVE: "Competitive",
  ELITE: "Elite",
};

export type PersonaSuggestResult = {
  suggestedSlug: string;
  suggestedLabel: string;
  exactMatch: PlanPersonaApi | null;
  similar: PlanPersonaApi[];
};

export function buildSuggestedPersonaLabel(opts: {
  capability?: AthletePersonaCapability | null;
  targetDistanceLabel?: string | null;
  personaGoalLabel?: string | null;
}): string {
  const cap =
    opts.capability && CAPABILITY_LABEL[opts.capability]
      ? CAPABILITY_LABEL[opts.capability]
      : "Runner";
  const tail =
    opts.personaGoalLabel?.trim() ||
    (opts.targetDistanceLabel?.trim() ? `${opts.targetDistanceLabel} focus` : "training focus");
  return `${cap} · ${tail}`;
}

export async function suggestPersonas(opts: {
  capability?: AthletePersonaCapability | null;
  targetDistanceLabel?: string | null;
  goalKind?: TrainingPlanGoalKind | null;
  personaGoalLabel?: string | null;
  suggestedSlug?: string | null;
}): Promise<PersonaSuggestResult> {
  const goalKind =
    opts.goalKind === "TRAINING_BLOCK" ? ("TRAINING_BLOCK" as const) : ("RACE" as const);

  const suggestedSlug =
    normalizeSlug(opts.suggestedSlug ?? "") ||
    buildPersonaSlug({
      capability: opts.capability,
      targetDistanceLabel: opts.targetDistanceLabel,
      goalKind,
    });

  const suggestedLabel = buildSuggestedPersonaLabel(opts);

  const exactRow = await findPersonaBySlug(suggestedSlug);
  const exactMatch = exactRow ? serializePlanPersona(exactRow) : null;

  const prefix = capabilityToSlugPrefix(opts.capability ?? null);
  const similarRows = await prisma.training_plan_persona.findMany({
    where: {
      ...(exactRow ? { id: { not: exactRow.id } } : {}),
      OR: [
        ...(opts.capability ? [{ capability: opts.capability }] : []),
        { slug: { startsWith: prefix } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  return {
    suggestedSlug,
    suggestedLabel,
    exactMatch,
    similar: similarRows.map(serializePlanPersona),
  };
}
