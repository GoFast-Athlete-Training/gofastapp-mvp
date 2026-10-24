"use client";

import type { RunInstanceWizardValues } from "./shared";

type Props = {
  values: RunInstanceWizardValues;
  onChange: (partial: Partial<RunInstanceWizardValues>) => void;
};

/** Public registration CTA — badge + Register link on the run page, not listing paste. */
export default function RunRegistrationFields({ values, onChange }: Props) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-950">
          Public registration
        </p>
        <p className="mt-1 text-xs text-amber-950/80">
          Athletes see this on the public run page: a Registration Required badge when you set
          yes, and a Register for Event link from the URL below.
        </p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-900">
          Registration required?
        </label>
        <select
          value={values.registrationRequiredUi}
          onChange={(e) =>
            onChange({
              registrationRequiredUi: e.target
                .value as RunInstanceWizardValues["registrationRequiredUi"],
            })
          }
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          <option value="unknown">Unknown / not set</option>
          <option value="required">Yes — registration required</option>
          <option value="optional">No — optional or open</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-900">
          Official registration URL
        </label>
        <input
          type="url"
          value={values.registrationUrl}
          onChange={(e) => onChange({ registrationUrl: e.target.value })}
          placeholder="https://www.eventbrite.com/tickets/…"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">
          Direct signup link for the public Register for Event button — not the listing URL on
          Source info.
        </p>
      </div>
    </div>
  );
}
