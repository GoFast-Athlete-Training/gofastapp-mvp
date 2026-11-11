/** Canonical heading for catalog charity + saved cause links on GoFast Links. */
export const CHARITY_LINK_SECTION_DEFAULT = "My causes";

const CHARITY_SECTION_LABELS = new Set([
  "my causes",
  "charities i support",
  "my charities",
  "charities",
  "causes",
]);

export function isCharityLinkSectionLabel(name: string): boolean {
  const norm = name.trim().toLowerCase();
  return CHARITY_SECTION_LABELS.has(norm);
}

export function findCharityLinkSectionId(
  sections: Array<{ id: string; label: string }>,
): string | null {
  for (const s of sections) {
    if (isCharityLinkSectionLabel(s.label)) return s.id;
  }
  return null;
}
