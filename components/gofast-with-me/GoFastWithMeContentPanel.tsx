'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookOpen, ExternalLink, Lightbulb, MapPin, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import type { AthleteTipMediaType, AthleteTipPayload } from '@/lib/gofast-with-me/athlete-tips';
import TipMediaPicker from '@/components/gofast-with-me/TipMediaPicker';

type Props = {
  athleteId: string;
  liveUrl: string;
  onOpenWorkouts?: () => void;
  onOpenCommunity?: () => void;
};

type TipDraft = {
  title: string;
  body: string;
  sortOrder: string;
  isPublished: boolean;
  mediaUrl: string | null;
  mediaType: AthleteTipMediaType | null;
};

const EMPTY_DRAFT: TipDraft = {
  title: '',
  body: '',
  sortOrder: '0',
  isPublished: false,
  mediaUrl: null,
  mediaType: null,
};

function tipPayloadToDraft(tip: AthleteTipPayload): TipDraft {
  return {
    title: tip.title,
    body: tip.body,
    sortOrder: String(tip.sortOrder),
    isPublished: tip.visibility === 'published',
    mediaUrl: tip.mediaUrl,
    mediaType: tip.mediaType,
  };
}

function draftToApiBody(draft: TipDraft) {
  return {
    title: draft.title,
    body: draft.body,
    sortOrder: Number(draft.sortOrder) || 0,
    isPublished: draft.isPublished,
    mediaUrl: draft.mediaUrl,
    mediaType: draft.mediaType,
  };
}

export default function GoFastWithMeCmsContentSection({
  athleteId,
  liveUrl,
  onOpenWorkouts,
  onOpenCommunity,
}: Props) {
  const [tips, setTips] = useState<AthleteTipPayload[]>([]);
  const [draft, setDraft] = useState<TipDraft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadTips = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/athlete/${athleteId}/tips`);
      setTips(Array.isArray(res.data?.tips) ? res.data.tips : []);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error || e.message || 'Could not load tips.');
    } finally {
      setLoading(false);
    }
  }, [athleteId]);

  useEffect(() => {
    void loadTips();
  }, [loadTips]);

  const createTip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim() || !draft.body.trim() || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.post(`/athlete/${athleteId}/tips`, draftToApiBody(draft));
      if (res.data?.tip) {
        setTips((prev) => [res.data.tip as AthleteTipPayload, ...prev]);
      } else {
        await loadTips();
      }
      setDraft(EMPTY_DRAFT);
      setSuccess(draft.isPublished ? 'Tip published.' : 'Tip saved as draft.');
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e2.response?.data?.error || e2.message || 'Could not save tip.');
    } finally {
      setSaving(false);
    }
  };

  const updateTip = async (tipId: string, next: TipDraft) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await api.put(`/athlete/${athleteId}/tips/${tipId}`, draftToApiBody(next));
      if (res.data?.tip) {
        const updated = res.data.tip as AthleteTipPayload;
        setTips((prev) => prev.map((tip) => (tip.id === updated.id ? updated : tip)));
        setSuccess(updated.visibility === 'published' ? 'Tip published.' : 'Tip saved as draft.');
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error || e.message || 'Could not update tip.');
      throw err;
    }
  };

  const deleteTip = async (tipId: string) => {
    if (!confirm('Delete this tip?')) return;
    setError(null);
    setSuccess(null);
    try {
      await api.delete(`/athlete/${athleteId}/tips/${tipId}`);
      setTips((prev) => prev.filter((tip) => tip.id !== tipId));
      setSuccess('Tip deleted.');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error || e.message || 'Could not delete tip.');
      throw err;
    }
  };

  const publishedCount = tips.filter((tip) => tip.visibility === 'published').length;

  return (
    <section id="content" className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Tips &amp; Thinking</h2>
        <p className="text-sm text-gray-600 mt-1">
          Short tips you talk about — training, nutrition, routes. Add a photo or video when it helps.
        </p>
      </div>

      <div className="rounded-lg border border-violet-200 bg-violet-50/50 px-4 py-3 text-xs text-violet-900">
        <strong>Tips are not announcements.</strong> Updates stay in Messages. Tips are
        athlete-owned content that hydrates the public page and community.
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}

      <form onSubmit={(e) => void createTip(e)} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-start gap-2">
          <Lightbulb className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Add a tip</h4>
            <p className="text-xs text-gray-600 mt-1">
              Write something evergreen — how you fuel, stay healthy, pick routes, or think about training.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
          <label className="block">
            <span className="text-xs font-semibold text-gray-700">Title</span>
            <input
              value={draft.title}
              onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
              maxLength={120}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Staying healthy during marathon prep"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-700">Order</span>
            <input
              value={draft.sortOrder}
              onChange={(e) => setDraft((prev) => ({ ...prev, sortOrder: e.target.value }))}
              inputMode="numeric"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Body</span>
          <textarea
            value={draft.body}
            onChange={(e) => setDraft((prev) => ({ ...prev, body: e.target.value }))}
            rows={6}
            maxLength={8000}
            className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-sm"
            placeholder="Share a practical tip your followers can come back to..."
          />
        </label>

        <TipMediaPicker
          mediaUrl={draft.mediaUrl}
          mediaType={draft.mediaType}
          disabled={saving}
          onChange={(next) =>
            setDraft((prev) => ({
              ...prev,
              mediaUrl: next.mediaUrl,
              mediaType: next.mediaType,
            }))
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={draft.isPublished}
              onChange={(e) => setDraft((prev) => ({ ...prev, isPublished: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-orange-600"
            />
            Publish now
          </label>
          <button
            type="submit"
            disabled={saving || !draft.title.trim() || !draft.body.trim()}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {saving ? 'Saving...' : draft.isPublished ? 'Publish tip' : 'Save draft'}
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Tip library</h3>
            <p className="text-xs text-gray-600 mt-1">
              {publishedCount} published · {tips.length - publishedCount} draft
            </p>
          </div>
          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700"
          >
            View public page
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        {loading ? (
          <p className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">Loading tips...</p>
        ) : tips.length > 0 ? (
          <div className="space-y-3">
            {tips.map((tip) => (
              <TipEditorCard
                key={tip.id}
                tip={tip}
                onSave={updateTip}
                onDelete={deleteTip}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
            No tips yet. Add your first durable thought above.
          </p>
        )}
      </section>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Still planned</h4>
          <p className="text-xs text-gray-600 mt-1">
            myRunRoutes and longer blog posts can follow this same athlete-owned content pattern.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onOpenWorkouts ? (
            <button
              type="button"
              onClick={onOpenWorkouts}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-100"
            >
              <MapPin className="h-3.5 w-3.5" />
              Runs &amp; Training
            </button>
          ) : null}
          {onOpenCommunity ? (
            <button
              type="button"
              onClick={onOpenCommunity}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-100"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Messages
            </button>
          ) : null}
          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700"
          >
            View public page
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
}

function TipEditorCard({
  tip,
  onSave,
  onDelete,
}: {
  tip: AthleteTipPayload;
  onSave: (tipId: string, next: TipDraft) => Promise<void>;
  onDelete: (tipId: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<TipDraft>(() => tipPayloadToDraft(tip));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setDraft(tipPayloadToDraft(tip));
  }, [tip.id, tip.updatedAt]);

  const save = async () => {
    if (!draft.title.trim() || !draft.body.trim() || saving) return;
    setSaving(true);
    try {
      await onSave(tip.id, draft);
    } catch {
      /* parent displays the API error */
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await onDelete(tip.id);
    } catch {
      /* parent displays the API error */
    } finally {
      setDeleting(false);
    }
  };

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
            tip.visibility === 'published'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          {tip.visibility}
        </span>
        <button
          type="button"
          onClick={() => void remove()}
          disabled={deleting}
          className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
        <input
          value={draft.title}
          onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
          maxLength={120}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold"
        />
        <input
          value={draft.sortOrder}
          onChange={(e) => setDraft((prev) => ({ ...prev, sortOrder: e.target.value }))}
          inputMode="numeric"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          aria-label="Sort order"
        />
      </div>

      <textarea
        value={draft.body}
        onChange={(e) => setDraft((prev) => ({ ...prev, body: e.target.value }))}
        rows={5}
        maxLength={8000}
        className="w-full rounded-lg border border-gray-300 p-3 text-sm"
      />

      <TipMediaPicker
        mediaUrl={draft.mediaUrl}
        mediaType={draft.mediaType}
        disabled={saving || deleting}
        onChange={(next) =>
          setDraft((prev) => ({
            ...prev,
            mediaUrl: next.mediaUrl,
            mediaType: next.mediaType,
          }))
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={draft.isPublished}
            onChange={(e) => setDraft((prev) => ({ ...prev, isPublished: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300 text-orange-600"
          />
          Published
        </label>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !draft.title.trim() || !draft.body.trim()}
          className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-100 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </article>
  );
}
