import { AthleteLinkTreeLinkKind } from "@prisma/client";

export { AthleteLinkTreeLinkKind };

export function isHydratedLinkKind(kind: AthleteLinkTreeLinkKind): boolean {
  return kind === AthleteLinkTreeLinkKind.RACES;
}

export function parseLinkKindInput(raw: unknown): AthleteLinkTreeLinkKind | null {
  if (raw === undefined || raw === null) return AthleteLinkTreeLinkKind.CUSTOM;
  const s = String(raw).trim().toUpperCase();
  if (s === "CUSTOM") return AthleteLinkTreeLinkKind.CUSTOM;
  if (s === "RACES") return AthleteLinkTreeLinkKind.RACES;
  return null;
}
