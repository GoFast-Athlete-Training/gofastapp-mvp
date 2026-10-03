import type { AffiliationPick } from "@/components/runmanage/RunManageRunAffiliations";
import type { PartnerExtra } from "@/lib/runmanage/partner-extras";
import { partnerExtrasForWrite } from "@/lib/runmanage/partner-extras";

export type SpecialEventDraft = {
  id: string | null;
  name: string;
  eventTitle: string;
  description: string;
  eventDate: string;
  url: string;
  brandId: string | null;
  brandPick: AffiliationPick | null;
  affiliatedClubs: PartnerExtra[];
};

export function emptySpecialEventDraft(): SpecialEventDraft {
  return {
    id: null,
    name: "",
    eventTitle: "",
    description: "",
    eventDate: "",
    url: "",
    brandId: null,
    brandPick: null,
    affiliatedClubs: [],
  };
}

export function specialEventApiBodyFromDraft(draft: SpecialEventDraft): Record<string, unknown> {
  const clubs = draft.affiliatedClubs.filter((e) => e.kind === "CLUB");
  const partnerExtras = partnerExtrasForWrite(clubs);
  return {
    name: draft.name.trim(),
    title: draft.eventTitle.trim() || null,
    description: draft.description.trim() || null,
    eventDate: draft.eventDate.trim() || null,
    url: draft.url.trim() || null,
    brandId: draft.brandId,
    partnerExtras: partnerExtras ?? null,
  };
}
