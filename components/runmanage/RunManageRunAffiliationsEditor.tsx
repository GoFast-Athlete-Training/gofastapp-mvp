"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import runmanageApi from "@/lib/runmanage/api-client";
import {
  RunManageRunAffiliations,
  affiliationsToPayload,
  draftFromRun,
  type RunAffiliationDraft,
} from "@/components/runmanage/RunManageRunAffiliations";

export function RunManageRunAffiliationsEditor({
  run,
  onSaved,
}: {
  run: Parameters<typeof draftFromRun>[0] & { id: string };
  onSaved: () => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<RunAffiliationDraft>(() => draftFromRun(run));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = affiliationsToPayload(draft);
      await runmanageApi.put(`/api/runs/${run.id}`, payload);
      setMessage("Affiliations saved.");
      await onSaved();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-gray-900">Type and affiliations</h2>
      <p className="mt-1 text-sm text-gray-600">
        Run scope and partners. Extra clubs are stored on the run when the type is special or shakeout.
      </p>
      <div className="mt-4">
        <RunManageRunAffiliations draft={draft} onChange={setDraft} />
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-green-700">{message}</p> : null}
      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save affiliations
      </button>
    </section>
  );
}
