import { AthleteLinkTreeLinkKind } from "@prisma/client";

export { AthleteLinkTreeLinkKind };

export function isHydratedLinkKind(kind: AthleteLinkTreeLinkKind): boolean {
  return kind === AthleteLinkTreeLinkKind.RACES;
}

export function isGeneratedRaceLinkKind(kind: AthleteLinkTreeLinkKind): boolean {
  return kind === AthleteLinkTreeLinkKind.ATHLETE_RACE;
}

export function isGeneratedCityRunLinkKind(kind: AthleteLinkTreeLinkKind): boolean {
  return kind === AthleteLinkTreeLinkKind.CITY_RUN;
}

export function isGeneratedContentLinkKind(kind: AthleteLinkTreeLinkKind): boolean {
  return isGeneratedRaceLinkKind(kind) || isGeneratedCityRunLinkKind(kind);
}

export function parseLinkKindInput(raw: unknown): AthleteLinkTreeLinkKind | null {
  if (raw === undefined || raw === null) return AthleteLinkTreeLinkKind.CUSTOM;
  const s = String(raw).trim().toUpperCase();
  if (s === "CUSTOM") return AthleteLinkTreeLinkKind.CUSTOM;
  if (s === "RACES") return AthleteLinkTreeLinkKind.RACES;
  if (s === "ATHLETE_RACE") return AthleteLinkTreeLinkKind.ATHLETE_RACE;
  if (s === "CITY_RUN") return AthleteLinkTreeLinkKind.CITY_RUN;
  return null;
}
