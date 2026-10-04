import type { CityRunTypeValue } from "@/lib/city-run-type";
import {
  parsePartnerExtras,
  type PartnerExtraKind,
} from "@/lib/runmanage/partner-extras";

/**
 * City run association canon.
 *
 * Every `city_runs` row resolves to exactly one CONTAINER — the entity that owns
 * the run and unlocks product behavior — plus any number of PARTNERS, which
 * carry attribution only and never change behavior.
 *
 * A column is not permanently one or the other. `runClubId` is the container on
 * a club run and a co-host partner on a race shakeout; `runBrandId` is always a
 * partner, because a brand-led event is modelled as `special_events` with a
 * brand lead. `CONTAINER_PRECEDENCE` is the only place that decision is made,
 * so staff create, Company sync, and athlete reads cannot disagree.
 */

export const CITY_RUN_CONTAINER_KINDS = [
  "RACE",
  "SPECIAL_EVENT",
  "RUN_STORE",
  "RUN_CLUB",
  "RUN_CREW",
  "ATHLETE",
  "NONE",
] as const;

export type CityRunContainerKind = (typeof CITY_RUN_CONTAINER_KINDS)[number];

export type CityRunAffiliationRefs = {
  raceRegistryId?: string | null;
  specialEventId?: string | null;
  runStoreId?: string | null;
  runClubId?: string | null;
  runCrewId?: string | null;
  athleteGeneratedId?: string | null;
  runBrandId?: string | null;
  shakeoutDedupeKey?: string | null;
  partnerExtras?: unknown;
};

/** Every `city_runs` column that points at an affiliated entity. */
export const CITY_RUN_AFFILIATION_ID_FIELDS = [
  "raceRegistryId",
  "specialEventId",
  "runStoreId",
  "runClubId",
  "runCrewId",
  "runBrandId",
  "athleteGeneratedId",
] as const satisfies readonly (keyof CityRunAffiliationRefs)[];

export type CityRunContainer = {
  kind: CityRunContainerKind;
  /** Null when the container is known but its id column is empty (legacy sync rows). */
  refId: string | null;
};

export type CityRunPartnerSlot = "lead" | "extra";

export type CityRunPartnerRef = {
  kind: PartnerExtraKind;
  refId: string;
  slot: CityRunPartnerSlot;
  nameSnapshot: string | null;
  logoUrlSnapshot: string | null;
};

function trimmed(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

type ContainerRule = {
  kind: Exclude<CityRunContainerKind, "NONE">;
  /** Column that supplies the container id. */
  refId: (refs: CityRunAffiliationRefs) => string | null;
  /** True when this container owns the run, even if `refId` is empty. */
  claims: (refs: CityRunAffiliationRefs) => boolean;
};

/** Highest-priority container wins. Order is the product hierarchy, not alphabetical. */
const CONTAINER_PRECEDENCE: readonly ContainerRule[] = [
  {
    kind: "RACE",
    refId: (r) => trimmed(r.raceRegistryId),
    // Company shakeout sync stamps the dedupe key before the registry is linked.
    claims: (r) => Boolean(trimmed(r.raceRegistryId) || trimmed(r.shakeoutDedupeKey)),
  },
  {
    kind: "SPECIAL_EVENT",
    refId: (r) => trimmed(r.specialEventId),
    claims: (r) => Boolean(trimmed(r.specialEventId)),
  },
  {
    kind: "RUN_STORE",
    refId: (r) => trimmed(r.runStoreId),
    claims: (r) => Boolean(trimmed(r.runStoreId)),
  },
  {
    kind: "RUN_CLUB",
    refId: (r) => trimmed(r.runClubId),
    claims: (r) => Boolean(trimmed(r.runClubId)),
  },
  {
    kind: "RUN_CREW",
    refId: (r) => trimmed(r.runCrewId),
    claims: (r) => Boolean(trimmed(r.runCrewId)),
  },
  {
    kind: "ATHLETE",
    refId: (r) => trimmed(r.athleteGeneratedId),
    claims: (r) => Boolean(trimmed(r.athleteGeneratedId)),
  },
];

export const CITY_RUN_TYPE_BY_CONTAINER: Record<CityRunContainerKind, CityRunTypeValue> = {
  RACE: "RACE_SHAKEOUT",
  SPECIAL_EVENT: "SPECIAL",
  RUN_STORE: "RUN_STORE",
  RUN_CLUB: "CLUB",
  RUN_CREW: "RUN_CREW",
  ATHLETE: "INDIVIDUAL",
  NONE: "OTHER",
};

const CONTAINER_BY_CITY_RUN_TYPE: Record<CityRunTypeValue, CityRunContainerKind> = {
  RACE_SHAKEOUT: "RACE",
  SPECIAL: "SPECIAL_EVENT",
  RUN_STORE: "RUN_STORE",
  CLUB: "RUN_CLUB",
  RUN_CREW: "RUN_CREW",
  INDIVIDUAL: "ATHLETE",
  OTHER: "NONE",
};

/** Container kind named by a stored/explicit `cityRunType`, or null when unusable. */
export function containerKindForCityRunType(value: unknown): CityRunContainerKind | null {
  if (typeof value !== "string") return null;
  return Object.prototype.hasOwnProperty.call(CONTAINER_BY_CITY_RUN_TYPE, value)
    ? CONTAINER_BY_CITY_RUN_TYPE[value as CityRunTypeValue]
    : null;
}

/**
 * Resolve the single container for a run.
 *
 * `storedType` (the persisted `city_runs.cityRunType`) wins when present — staff
 * chose it deliberately, and a club-hosted run may still carry a race tag. Only
 * when it is absent do we fall back to column precedence.
 */
export function resolveCityRunContainer(
  refs: CityRunAffiliationRefs,
  storedType?: unknown
): CityRunContainer {
  const named = containerKindForCityRunType(storedType);
  if (named) {
    if (named === "NONE") return { kind: "NONE", refId: null };
    const rule = CONTAINER_PRECEDENCE.find((entry) => entry.kind === named);
    return { kind: named, refId: rule ? rule.refId(refs) : null };
  }
  for (const rule of CONTAINER_PRECEDENCE) {
    if (rule.claims(refs)) return { kind: rule.kind, refId: rule.refId(refs) };
  }
  return { kind: "NONE", refId: null };
}

/** Container kinds that occupy a partner slot, so the container is not listed twice. */
const PARTNER_KIND_BY_CONTAINER: Partial<Record<CityRunContainerKind, PartnerExtraKind>> = {
  RUN_STORE: "STORE",
  RUN_CLUB: "CLUB",
};

/**
 * Every attribution stamp on the run, container excluded, deduped by kind + id.
 * Lead slots (`runBrandId`, `runStoreId`, `runClubId`) come before `partnerExtras`.
 */
export function resolveCityRunPartners(
  refs: CityRunAffiliationRefs,
  storedType?: unknown
): CityRunPartnerRef[] {
  const container = resolveCityRunContainer(refs, storedType);
  const seen = new Set<string>();
  const containerAsPartner = PARTNER_KIND_BY_CONTAINER[container.kind];
  if (containerAsPartner && container.refId) {
    seen.add(`${containerAsPartner}:${container.refId}`);
  }

  const partners: CityRunPartnerRef[] = [];
  const add = (
    kind: PartnerExtraKind,
    refId: string | null,
    slot: CityRunPartnerSlot,
    nameSnapshot: string | null = null,
    logoUrlSnapshot: string | null = null
  ) => {
    if (!refId) return;
    const key = `${kind}:${refId}`;
    if (seen.has(key)) return;
    seen.add(key);
    partners.push({ kind, refId, slot, nameSnapshot, logoUrlSnapshot });
  };

  // Brand is never a container — a brand-led event goes through special_events.
  add("BRAND", trimmed(refs.runBrandId), "lead");
  add("STORE", trimmed(refs.runStoreId), "lead");
  add("CLUB", trimmed(refs.runClubId), "lead");
  for (const extra of parsePartnerExtras(refs.partnerExtras)) {
    add(extra.kind, extra.refId, "extra", extra.nameSnapshot, extra.logoUrlSnapshot ?? null);
  }
  return partners;
}

export const CITY_RUN_CONTAINER_LABELS: Record<CityRunContainerKind, string> = {
  RACE: "Race",
  SPECIAL_EVENT: "Special event",
  RUN_STORE: "Run store",
  RUN_CLUB: "Club",
  RUN_CREW: "Run crew",
  ATHLETE: "Host",
  NONE: "Run",
};

export const CITY_RUN_PARTNER_LABELS: Record<PartnerExtraKind, string> = {
  BRAND: "Brand",
  STORE: "Run store",
  CLUB: "Club",
};

/**
 * Relation half of the affiliation fragment, for `city_runs` queries that use
 * `include` (which cannot carry scalar fields).
 */
export const CITY_RUN_AFFILIATION_INCLUDE = {
  runClub: {
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      city: true,
      state: true,
      websiteUrl: true,
    },
  },
  runStore: {
    select: { id: true, name: true, logoUrl: true, city: true, state: true, websiteUrl: true },
  },
  runBrand: {
    select: { id: true, name: true, logoUrl: true, city: true, state: true, websiteUrl: true },
  },
  race_registry: {
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      state: true,
      logoUrl: true,
      raceDate: true,
      officialWebsiteUrl: true,
    },
  },
  specialEvent: {
    select: {
      id: true,
      name: true,
      title: true,
      url: true,
      eventDate: true,
      brand: { select: { id: true, name: true, logoUrl: true, websiteUrl: true } },
    },
  },
  run_crews: { select: { id: true, name: true, handle: true, logo: true } },
  Athlete: {
    select: { id: true, firstName: true, lastName: true, photoURL: true, gofastHandle: true },
  },
} as const;

/**
 * Prisma `select` fragment that hydrates every association in one query.
 * Spread it into a `city_runs` select, then hand the row to
 * `serializeCityRunAffiliations`.
 */
export const CITY_RUN_AFFILIATION_SELECT = {
  cityRunType: true,
  runClubId: true,
  runCrewId: true,
  runStoreId: true,
  runBrandId: true,
  raceRegistryId: true,
  specialEventId: true,
  athleteGeneratedId: true,
  shakeoutDedupeKey: true,
  partnerExtras: true,
  ...CITY_RUN_AFFILIATION_INCLUDE,
} as const;

type NamedRow = {
  id: string;
  name: string | null;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  slug?: string | null;
  city?: string | null;
  state?: string | null;
};

/**
 * Row shape produced by `CITY_RUN_AFFILIATION_SELECT`. Relations are optional so
 * routes that select only the id columns still typecheck — they get ids back
 * with null names instead of a compile error.
 */
export type CityRunAffiliationRow = CityRunAffiliationRefs & {
  cityRunType?: string | null;
  runClub?: NamedRow | null;
  runStore?: NamedRow | null;
  runBrand?: NamedRow | null;
  race_registry?:
    | (NamedRow & { raceDate?: Date | string | null; officialWebsiteUrl?: string | null })
    | null;
  specialEvent?:
    | {
        id: string;
        name: string | null;
        title?: string | null;
        url?: string | null;
        eventDate?: Date | string | null;
        brand?: { id: string; name: string | null; logoUrl?: string | null; websiteUrl?: string | null } | null;
      }
    | null;
  run_crews?: { id: string; name: string | null; handle?: string | null; logo?: string | null } | null;
  Athlete?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    photoURL?: string | null;
    gofastHandle?: string | null;
  } | null;
};

export type CityRunAffiliationEntity = {
  id: string | null;
  /** Container kind (`RACE`) or partner kind (`BRAND`). */
  kind: CityRunContainerKind | PartnerExtraKind;
  label: string;
  name: string | null;
  subtitle: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  /** In-app page for this entity, when one exists. */
  href: string | null;
};

export type CityRunAffiliationPartner = CityRunAffiliationEntity & {
  kind: PartnerExtraKind;
  slot: CityRunPartnerSlot;
};

export type CityRunAffiliations = {
  cityRunType: CityRunTypeValue;
  /** Null only when nothing owns the run (`OTHER`). */
  container: CityRunAffiliationEntity | null;
  partners: CityRunAffiliationPartner[];
};

function placeLine(city?: string | null, state?: string | null): string | null {
  const line = [city?.trim() || null, state?.trim() || null].filter(Boolean).join(", ");
  return line || null;
}

function yearLabel(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : String(d.getUTCFullYear());
}

function athleteName(a: CityRunAffiliationRow["Athlete"]): string | null {
  if (!a) return null;
  const full = [a.firstName?.trim(), a.lastName?.trim()].filter(Boolean).join(" ");
  return full || a.gofastHandle?.trim() || null;
}

function containerEntity(
  container: CityRunContainer,
  row: CityRunAffiliationRow
): CityRunAffiliationEntity | null {
  if (container.kind === "NONE") return null;
  const base = {
    kind: container.kind,
    label: CITY_RUN_CONTAINER_LABELS[container.kind],
    id: container.refId,
  };

  switch (container.kind) {
    case "RACE": {
      const race = row.race_registry ?? null;
      return {
        ...base,
        name: race?.name ?? null,
        subtitle: placeLine(race?.city, race?.state) ?? yearLabel(race?.raceDate),
        logoUrl: race?.logoUrl ?? null,
        websiteUrl: race?.officialWebsiteUrl ?? null,
        href: container.refId ? `/race-hub/${container.refId}` : null,
      };
    }
    case "SPECIAL_EVENT": {
      const event = row.specialEvent ?? null;
      return {
        ...base,
        name: event?.name ?? null,
        subtitle: event?.title?.trim() || event?.brand?.name || null,
        logoUrl: event?.brand?.logoUrl ?? null,
        websiteUrl: event?.url ?? null,
        href: null,
      };
    }
    case "RUN_STORE": {
      const store = row.runStore ?? null;
      return {
        ...base,
        name: store?.name ?? null,
        subtitle: placeLine(store?.city, store?.state),
        logoUrl: store?.logoUrl ?? null,
        websiteUrl: store?.websiteUrl ?? null,
        href: null,
      };
    }
    case "RUN_CLUB": {
      const club = row.runClub ?? null;
      return {
        ...base,
        name: club?.name ?? null,
        subtitle: placeLine(club?.city, club?.state),
        logoUrl: club?.logoUrl ?? null,
        websiteUrl: club?.websiteUrl ?? null,
        href: club?.slug ? `/runclub/${club.slug}` : null,
      };
    }
    case "RUN_CREW": {
      const crew = row.run_crews ?? null;
      return {
        ...base,
        name: crew?.name ?? null,
        subtitle: crew?.handle ? `@${crew.handle}` : null,
        logoUrl: crew?.logo ?? null,
        websiteUrl: null,
        href: crew?.handle ? `/runcrew/${crew.handle}` : null,
      };
    }
    case "ATHLETE": {
      const athlete = row.Athlete ?? null;
      return {
        ...base,
        name: athleteName(athlete),
        subtitle: athlete?.gofastHandle ? `@${athlete.gofastHandle}` : null,
        logoUrl: athlete?.photoURL ?? null,
        websiteUrl: null,
        href: athlete?.gofastHandle ? `/u/${athlete.gofastHandle}` : null,
      };
    }
  }
}

function partnerEntity(
  partner: CityRunPartnerRef,
  row: CityRunAffiliationRow
): CityRunAffiliationPartner {
  const lead: NamedRow | null | undefined =
    partner.slot === "lead"
      ? partner.kind === "BRAND"
        ? row.runBrand
        : partner.kind === "STORE"
          ? row.runStore
          : row.runClub
      : null;
  const hydrated = lead?.id === partner.refId ? lead : null;

  return {
    kind: partner.kind,
    slot: partner.slot,
    label: CITY_RUN_PARTNER_LABELS[partner.kind],
    id: partner.refId,
    name: hydrated?.name ?? partner.nameSnapshot,
    subtitle: placeLine(hydrated?.city, hydrated?.state),
    logoUrl: hydrated?.logoUrl ?? partner.logoUrlSnapshot,
    websiteUrl: hydrated?.websiteUrl ?? null,
    href: partner.kind === "CLUB" && hydrated?.slug ? `/runclub/${hydrated.slug}` : null,
  };
}

/** Container + partners for an already-selected run row. Does not query. */
export function serializeCityRunAffiliations(row: CityRunAffiliationRow): CityRunAffiliations {
  const container = resolveCityRunContainer(row, row.cityRunType);
  return {
    cityRunType: CITY_RUN_TYPE_BY_CONTAINER[container.kind],
    container: containerEntity(container, row),
    partners: resolveCityRunPartners(row, row.cityRunType).map((p) => partnerEntity(p, row)),
  };
}

/**
 * Reject writes the association model cannot represent, before Prisma turns a
 * bad id into an opaque 500. Returns null when the shape is valid.
 */
export function validateCityRunAffiliationShape(
  refs: CityRunAffiliationRefs,
  explicitType?: unknown
): string | null {
  const named = containerKindForCityRunType(explicitType);
  if (explicitType !== undefined && explicitType !== null && !named) {
    return `Unknown cityRunType "${String(explicitType)}"`;
  }
  if (!named || named === "NONE") return null;

  const rule = CONTAINER_PRECEDENCE.find((entry) => entry.kind === named);
  if (rule && !rule.claims(refs)) {
    const column: Record<Exclude<CityRunContainerKind, "NONE">, string> = {
      RACE: "raceRegistryId",
      SPECIAL_EVENT: "specialEventId",
      RUN_STORE: "runStoreId",
      RUN_CLUB: "runClubId",
      RUN_CREW: "runCrewId",
      ATHLETE: "athleteGeneratedId",
    };
    return `${column[named]} is required for ${String(explicitType)} runs`;
  }
  return null;
}
