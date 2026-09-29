import { formatSeriesTime } from "@/lib/acqRunSeriesDisplay";
import {
  buildSeriesScopeKey,
  findDuplicateScopeGroups,
  groupSeriesByScopeKey,
  resolveScopeCitySlug,
} from "@/lib/runSeriesScopeKey";

export type CompanySeriesScopeRow = {
  id: string;
  slug: string;
  name: string | null;
  dayOfWeek: string;
  citySlug: string | null;
  meetUpCity: string | null;
  meetUpState: string | null;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  syncedToProd: boolean;
};

export type ProductRunScopeRow = {
  id: string;
  title: string;
  date: string;
  runSeriesId: string | null;
  runClubId: string | null;
  dayOfWeek: string | null;
  citySlug: string | null;
  meetUpCity: string | null;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  published: boolean;
  workflowStatus: string | null;
};

export type SeriesScopeDiagnosticRow = CompanySeriesScopeRow & {
  scopeKey: string;
  instanceCount: number;
  duplicateGroupSize: number;
  recommendedAction: "keep" | "review_duplicate" | "build_first_run" | "orphan_review";
  recommendationReason: string;
};

export type ClubSeriesScopeReport = {
  clubId: string;
  clubName: string;
  clubSlug: string | null;
  series: SeriesScopeDiagnosticRow[];
  duplicateGroups: Array<{
    scopeKey: string;
    seriesIds: string[];
    slugs: string[];
    recommendation: string;
  }>;
  unlinkedRuns: ProductRunScopeRow[];
  summary: {
    seriesCount: number;
    duplicateGroupCount: number;
    seriesWithInstances: number;
    seriesWithoutInstances: number;
    unlinkedRunCount: number;
  };
};

function scopeFieldsFromCompanySeries(clubId: string, row: CompanySeriesScopeRow) {
  return {
    clubId,
    citySlug: row.citySlug,
    meetUpCity: row.meetUpCity,
    meetUpState: row.meetUpState,
    dayOfWeek: row.dayOfWeek,
    startTimeHour: row.startTimeHour,
    startTimeMinute: row.startTimeMinute,
    startTimePeriod: row.startTimePeriod,
  };
}

export function formatScopeKeyHuman(scopeKey: string): string {
  const [, city, day, timePart] = scopeKey.split("|");
  const cityLabel = city ?? "?";
  const dayLabel = day ?? "?";
  if (timePart === "notime") return `${dayLabel} · ${cityLabel}`;
  const mins = Number(timePart);
  if (!Number.isFinite(mins)) return `${dayLabel} · ${cityLabel}`;
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  const time = formatSeriesTime(h12, m, period);
  return `${dayLabel} · ${cityLabel} · ${time}`;
}

export function buildClubSeriesScopeReport(opts: {
  clubId: string;
  clubName: string;
  clubSlug: string | null;
  companySeries: CompanySeriesScopeRow[];
  instanceCountBySeriesId: Record<string, number>;
  productRuns?: ProductRunScopeRow[];
}): ClubSeriesScopeReport {
  const { clubId, clubName, clubSlug, companySeries, instanceCountBySeriesId, productRuns = [] } =
    opts;

  const duplicateGroupsRaw = findDuplicateScopeGroups(
    companySeries.map((s) => ({
      ...scopeFieldsFromCompanySeries(clubId, s),
      id: s.id,
    }))
  );

  const duplicateSizeById = new Map<string, number>();
  for (const group of duplicateGroupsRaw) {
    for (const row of group.rows) {
      duplicateSizeById.set((row as { id: string }).id, group.rows.length);
    }
  }

  const series: SeriesScopeDiagnosticRow[] = companySeries.map((row) => {
    const scopeKey = buildSeriesScopeKey(scopeFieldsFromCompanySeries(clubId, row));
    const instanceCount = instanceCountBySeriesId[row.id] ?? 0;
    const duplicateGroupSize = duplicateSizeById.get(row.id) ?? 1;

    let recommendedAction: SeriesScopeDiagnosticRow["recommendedAction"] = "keep";
    let recommendationReason = "Series has expected scope.";

    if (duplicateGroupSize > 1) {
      recommendedAction = "review_duplicate";
      recommendationReason =
        instanceCount > 0
          ? "Duplicate scope key — keep this row (has instances)."
          : "Duplicate scope key — review before building; sibling may already have instances.";
    } else if (instanceCount === 0) {
      recommendedAction = "build_first_run";
      recommendationReason = "No Product city_runs attached to this series id.";
    }

    return {
      ...row,
      scopeKey,
      instanceCount,
      duplicateGroupSize,
      recommendedAction,
      recommendationReason,
    };
  });

  const unlinkedRuns = productRuns.filter((r) => !r.runSeriesId);

  const duplicateGroups = duplicateGroupsRaw.map((g) => {
    const ids = g.rows.map((r) => (r as { id: string }).id);
    const slugs = companySeries.filter((s) => ids.includes(s.id)).map((s) => s.slug);
    const withInstances = ids.filter((id) => (instanceCountBySeriesId[id] ?? 0) > 0);
    const recommendation =
      withInstances.length === 1
        ? `Keep series ${withInstances[0]} (has instances); review/delete unused siblings: ${ids.filter((id) => id !== withInstances[0]).join(", ") || "none"}.`
        : withInstances.length > 1
          ? `Multiple duplicates have instances — manual merge review required (${withInstances.join(", ")}).`
          : `No instances on any duplicate — pick one canonical series and delete siblings (${ids.join(", ")}).`;

    return {
      scopeKey: g.scopeKey,
      seriesIds: ids,
      slugs,
      recommendation,
    };
  });

  return {
    clubId,
    clubName,
    clubSlug,
    series,
    duplicateGroups,
    unlinkedRuns,
    summary: {
      seriesCount: series.length,
      duplicateGroupCount: duplicateGroups.length,
      seriesWithInstances: series.filter((s) => s.instanceCount > 0).length,
      seriesWithoutInstances: series.filter((s) => s.instanceCount === 0).length,
      unlinkedRunCount: unlinkedRuns.length,
    },
  };
}

/** Map series id → duplicate group size for board badges. */
export function duplicateGroupSizeBySeriesId(
  clubId: string,
  series: Array<
    Pick<
      CompanySeriesScopeRow,
      | "id"
      | "citySlug"
      | "meetUpCity"
      | "meetUpState"
      | "dayOfWeek"
      | "startTimeHour"
      | "startTimeMinute"
      | "startTimePeriod"
    >
  >
): Map<string, number> {
  const groups = groupSeriesByScopeKey(
    series.map((s) => ({
      ...scopeFieldsFromCompanySeries(clubId, s as CompanySeriesScopeRow),
      id: s.id,
    }))
  );
  const out = new Map<string, number>();
  for (const g of groups) {
    for (const row of g.rows) {
      out.set((row as { id: string }).id, g.rows.length);
    }
  }
  return out;
}

export function seriesScopeCityLabel(row: {
  citySlug?: string | null;
  meetUpCity?: string | null;
  meetUpState?: string | null;
}): string | null {
  const slug = resolveScopeCitySlug(row.citySlug, row.meetUpCity, row.meetUpState);
  if (slug === "unknown") return row.meetUpCity?.trim() || null;
  return slug;
}
