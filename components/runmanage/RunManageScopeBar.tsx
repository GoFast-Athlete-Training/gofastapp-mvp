"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import runmanageApi from "@/lib/runmanage/api-client";
import type { RegionCityOption } from "@/lib/runmanage/week-board-filters";
import { scopeFromSearchParams } from "@/lib/runmanage/scope-query";

export function RunManageScopeBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scope = scopeFromSearchParams(searchParams);
  const [options, setOptions] = useState<RegionCityOption[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await runmanageApi.get("/api/runmanage/run-series");
        if (res.data?.success) {
          setOptions((res.data.filterOptions ?? []) as RegionCityOption[]);
        }
      } catch {
        setOptions([]);
      }
    })();
  }, []);

  const regionOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of options) {
      map.set(o.regionSlug, o.regionName);
    }
    return [...map.entries()].map(([slug, name]) => ({ slug, name }));
  }, [options]);

  const cityOptions = useMemo(() => {
    return options
      .filter((o) => !scope.region || o.regionSlug === scope.region)
      .map((o) => ({ slug: o.citySlug, name: o.cityName }));
  }, [options, scope.region]);

  const setScope = useCallback(
    (next: { region?: string; city?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.region !== undefined) {
        if (next.region) params.set("region", next.region);
        else params.delete("region");
        if (next.region !== scope.region) {
          params.delete("city");
          params.delete("clubId");
        }
      }
      if (next.city !== undefined) {
        if (next.city) params.set("city", next.city);
        else params.delete("city");
        params.delete("clubId");
      }
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, scope.region, searchParams]
  );

  return (
    <div className="border-b border-gray-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="font-medium text-gray-700">Region *</span>
          <select
            value={scope.region}
            onChange={(e) => setScope({ region: e.target.value })}
            className="mt-1 block min-w-[180px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Select region…</option>
            {regionOptions.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-700">City</span>
          <select
            value={scope.city}
            onChange={(e) => setScope({ city: e.target.value })}
            disabled={!scope.region}
            className="mt-1 block min-w-[180px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-50"
          >
            <option value="">All cities in region</option>
            {cityOptions.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {!scope.region ? (
          <p className="pb-2 text-xs text-amber-800">Pick a region to load this week&apos;s runs.</p>
        ) : null}
      </div>
    </div>
  );
}
