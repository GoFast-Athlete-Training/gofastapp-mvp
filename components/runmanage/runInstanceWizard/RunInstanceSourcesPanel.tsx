"use client";

import type { RunInstanceWizardValues } from "./shared";

type Props = {
  values: RunInstanceWizardValues;
  onChange: (partial: Partial<RunInstanceWizardValues>) => void;
};

export default function RunInstanceSourcesPanel({ values, onChange }: Props) {
  return (
    <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50/40 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-900">
          Run-specific sources
        </p>
        <p className="mt-1 text-xs text-sky-950/80">
          True source material for this dated run — staff-only, not shown on the public page. Paste
          the Strava event, web listing, or IG post for this week before drafting description copy.
        </p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-900">
          Run-specific Strava event URL
        </label>
        <input
          type="url"
          value={values.stravaEventUrl}
          onChange={(e) => onChange({ stravaEventUrl: e.target.value })}
          placeholder="https://www.strava.com/clubs/…/group_events/…"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">
          This week&apos;s Strava event page — not the route link (that goes on Route step).
        </p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-900">
          Pasted Strava event description
        </label>
        <textarea
          value={values.stravaText}
          onChange={(e) => onChange({ stravaText: e.target.value })}
          rows={3}
          placeholder="Paste this run's Strava event description."
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-900">
          Run-specific web page URL
        </label>
        <input
          type="url"
          value={values.webUrl}
          onChange={(e) => onChange({ webUrl: e.target.value })}
          placeholder="Listing or announcement page for this run"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-900">Pasted web copy</label>
        <textarea
          value={values.webText}
          onChange={(e) => onChange({ webText: e.target.value })}
          rows={3}
          placeholder="Paste relevant text from the run listing or announcement page."
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-900">Instagram post text</label>
        <textarea
          value={values.igPostText}
          onChange={(e) => onChange({ igPostText: e.target.value })}
          rows={3}
          placeholder="Paste this run's IG caption when it was promoted there."
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}

export function hasRunInstanceSources(values: RunInstanceWizardValues): boolean {
  return Boolean(
    values.stravaEventUrl.trim() ||
      values.stravaText.trim() ||
      values.webUrl.trim() ||
      values.webText.trim() ||
      values.igPostText.trim()
  );
}
