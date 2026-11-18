"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";
import runmanageApi from "@/lib/runmanage/api-client";
import { RUN_MANAGE_CLUBS_PATH } from "@/lib/runmanage/paths";
import type { SeriesManageRow } from "@/lib/runmanage/series-manage-list";
import { RunManageSeriesDayList } from "@/components/runmanage/RunManageSeriesDayList";
import { RunManageSeriesMetaForm } from "@/components/runmanage/RunManageSeriesMetaForm";

type ClubMeta = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  citySlug: string | null;
  state: string | null;
  description: string | null;
  allRunsDescription: string | null;
  websiteUrl: string | null;
  runUrl: string | null;
  instagramUrl: string | null;
  stravaUrl: string | null;
};

export function RunManageClubHome({ clubId }: { clubId: string }) {
  const [club, setClub] = useState<ClubMeta | null>(null);
  const [rows, setRows] = useState<SeriesManageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editRow, setEditRow] = useState<SeriesManageRow | null>(null);

  const [description, setDescription] = useState("");
  const [allRunsDescription, setAllRunsDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [runUrl, setRunUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [stravaUrl, setStravaUrl] = useState("");

  const applyClub = (next: ClubMeta) => {
    setClub(next);
    setDescription(next.description ?? "");
    setAllRunsDescription(next.allRunsDescription ?? "");
    setWebsiteUrl(next.websiteUrl ?? "");
    setRunUrl(next.runUrl ?? "");
    setInstagramUrl(next.instagramUrl ?? "");
    setStravaUrl(next.stravaUrl ?? "");
  };

  const loadSeries = useCallback(async () => {
    const params = new URLSearchParams({ view: "manage", clubId });
    const res = await runmanageApi.get(`/api/runmanage/run-series?${params.toString()}`);
    if (res.data?.success) {
      setRows((res.data.manageSeries ?? []) as SeriesManageRow[]);
    }
  }, [clubId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [clubRes] = await Promise.all([
        runmanageApi.get(`/api/runmanage/run-clubs/${encodeURIComponent(clubId)}`),
        loadSeries(),
      ]);
      if (!clubRes.data?.success || !clubRes.data.runClub) {
        setError(clubRes.data?.error || "Club not found");
        setClub(null);
        return;
      }
      applyClub(clubRes.data.runClub as ClubMeta);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || "Failed to load club");
    } finally {
      setLoading(false);
    }
  }, [clubId, loadSeries]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveMeta = async () => {
    setSaving(true);
    setSaveNote(null);
    try {
      const res = await runmanageApi.put(`/api/runmanage/run-clubs/${encodeURIComponent(clubId)}`, {
        description,
        allRunsDescription,
        websiteUrl,
        runUrl,
        instagramUrl,
        stravaUrl,
      });
      if (!res.data?.success || !res.data.runClub) {
        setSaveNote(res.data?.error || "Could not save club");
        return;
      }
      applyClub({ ...(club as ClubMeta), ...(res.data.runClub as ClubMeta) });
      setSaveNote("Saved");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setSaveNote(err.response?.data?.error || err.message || "Could not save club");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading club…
      </div>
    );
  }

  if (!club) {
    return (
      <div className="space-y-3">
        <Link href={RUN_MANAGE_CLUBS_PATH} className="text-sm font-medium text-sky-700 hover:underline">
          All clubs
        </Link>
        <p className="text-sm text-red-700">{error || "Club not found"}</p>
      </div>
    );
  }

  const place = [club.city, club.state].filter(Boolean).join(", ");

  return (
    <div className="space-y-8">
      <div>
        <Link href={RUN_MANAGE_CLUBS_PATH} className="text-sm font-medium text-sky-700 hover:underline">
          All clubs
        </Link>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-sky-700">Club</p>
        <h1 className="text-2xl font-bold text-gray-900">{club.name}</h1>
        <p className="mt-1 text-sm text-gray-600">{place || club.slug}</p>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Club meta</h2>
        <label className="block text-sm">
          <span className="font-medium text-gray-700">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-700">All runs description</span>
          <textarea
            value={allRunsDescription}
            onChange={(e) => setAllRunsDescription(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <UrlField label="Website" value={websiteUrl} onChange={setWebsiteUrl} />
          <UrlField label="Runs page" value={runUrl} onChange={setRunUrl} />
          <UrlField label="Instagram" value={instagramUrl} onChange={setInstagramUrl} />
          <UrlField label="Strava" value={stravaUrl} onChange={setStravaUrl} />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveMeta()}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save club"}
          </button>
          {saveNote ? <p className="text-sm text-gray-600">{saveNote}</p> : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Series</h2>
        <p className="text-sm text-gray-600">Weekly slots attached to this club.</p>
        <RunManageSeriesDayList
          rows={rows}
          onEdit={(row) => {
            setEditRow(row);
            setFormOpen(true);
          }}
        />
      </section>

      <RunManageSeriesMetaForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditRow(null);
        }}
        onSaved={() => void loadSeries()}
        citySlug={editRow?.citySlug || club.citySlug || ""}
        initial={editRow}
      />
    </div>
  );
}

function UrlField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-gray-700">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
    </label>
  );
}
