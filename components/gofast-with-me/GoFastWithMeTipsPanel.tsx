'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Lightbulb, PenLine, Sparkles, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import type { AthleteTipMediaType, AthleteTipPayload, AthleteTipSeriesItem } from '@/lib/gofast-with-me/athlete-tips';
import TipMediaPicker from '@/components/gofast-with-me/TipMediaPicker';

type Props = {
  athleteId: string;
  liveUrl: string;
};

type TipComposeMode = 'ai' | 'manual';

type TipDraft = {
  title: string;
  body: string;
  takeaway: string;
  seriesTitle: string;
  seriesItems: AthleteTipSeriesItem[];
  sortOrder: string;
  showOnLanding: boolean;
  showOnFeed: boolean;
  mediaUrl: string | null;
  mediaType: AthleteTipMediaType | null;
};

const EMPTY_DRAFT: TipDraft = {
  title: '',
  body: '',
  takeaway: '',
  seriesTitle: '',
  seriesItems: [],
  sortOrder: '0',
  showOnLanding: true,
  showOnFeed: true,
  mediaUrl: null,
  mediaType: null,
};

function tipPayloadToDraft(tip: AthleteTipPayload): TipDraft {
  return {
    title: tip.title,
    body: tip.body,
    takeaway: tip.takeaway ?? '',
    seriesTitle: tip.tipSeries?.title ?? '',
    seriesItems: tip.tipSeries?.tips ?? [],
    sortOrder: String(tip.sortOrder),
    showOnLanding: tip.showOnLanding,
    showOnFeed: tip.showOnFeed,
    mediaUrl: tip.mediaUrl,
    mediaType: tip.mediaType,
  };
}

function draftToApiBody(draft: TipDraft) {
  const seriesTips = draft.seriesItems
    .map((item) => ({
      title: item.title.trim(),
      body: item.body.trim(),
    }))
    .filter((item) => item.title || item.body);

  return {
    title: draft.title,
    body: draft.body,
    takeaway: draft.takeaway.trim() || null,
    tipSeries:
      seriesTips.length > 0 || draft.seriesTitle.trim()
        ? {
            title: draft.seriesTitle.trim() || null,
            tips: seriesTips,
          }
        : null,
    sortOrder: Number(draft.sortOrder) || 0,
    showOnLanding: draft.showOnLanding,
    showOnFeed: draft.showOnFeed,
    mediaUrl: draft.mediaUrl,
    mediaType: draft.mediaType,
  };
}

export default function GoFastWithMeTipsPanel({ athleteId, liveUrl }: Props) {
  const [tips, setTips] = useState<AthleteTipPayload[]>([]);
  const [composeMode, setComposeMode] = useState<TipComposeMode | null>(null);
  const [aboutSeed, setAboutSeed] = useState('');
  const [drafting, setDrafting] = useState(false);
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

  const draftWithAi = async () => {
    if (!aboutSeed.trim() || drafting) return;
    setDrafting(true);
    setError(null);
    try {
      const res = await api.post(`/athlete/${athleteId}/tips/draft`, { about: aboutSeed.trim() });
      if (res.data?.title && res.data?.body) {
        const tipSeries = res.data.tipSeries as { title?: string | null; tips?: AthleteTipSeriesItem[] } | null;
        setDraft((prev) => ({
          ...prev,
          title: String(res.data.title),
          body: String(res.data.body),
          takeaway: res.data.takeaway ? String(res.data.takeaway) : '',
          seriesTitle: tipSeries?.title ? String(tipSeries.title) : '',
          seriesItems: Array.isArray(tipSeries?.tips) ? tipSeries.tips : [],
        }));
        setSuccess('Draft ready — review fields below, then choose where to publish.');
      } else {
        throw new Error(res.data?.error || 'Could not draft tip.');
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error || e.message || 'Could not draft tip.');
    } finally {
      setDrafting(false);
    }
  };

  const createTip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim() || !draft.body.trim() || saving) return;
    if (!draft.showOnLanding && !draft.showOnFeed) {
      setError('Choose at least one surface — Landing page or Feed.');
      return;
    }
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
      setAboutSeed('');
      setComposeMode(null);
      setSuccess(
        draft.showOnLanding && draft.showOnFeed
          ? 'Tip published to Landing and Feed.'
          : draft.showOnLanding
            ? 'Tip published to Landing page.'
            : 'Tip published to Feed.'
      );
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e2.response?.data?.error || e2.message || 'Could not save tip.');
    } finally {
      setSaving(false);
    }
  };

  const saveDraftOnly = async () => {
    if (!draft.title.trim() || !draft.body.trim() || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = { ...draftToApiBody(draft), showOnLanding: false, showOnFeed: false };
      const res = await api.post(`/athlete/${athleteId}/tips`, payload);
      if (res.data?.tip) {
        setTips((prev) => [res.data.tip as AthleteTipPayload, ...prev]);
      } else {
        await loadTips();
      }
      setDraft(EMPTY_DRAFT);
      setAboutSeed('');
      setComposeMode(null);
      setSuccess('Tip saved as draft.');
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
        setSuccess(updated.visibility === 'published' ? 'Tip updated.' : 'Tip saved as draft.');
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
    <section id="tips" className="space-y-6 pb-8 max-w-3xl">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Tips</h2>
        <p className="text-sm text-gray-600 mt-1">
          Durable training thoughts — build first, then choose Landing page and/or Feed.
        </p>
      </div>

      <div className="rounded-lg border border-violet-200 bg-violet-50/50 px-4 py-3 text-xs text-violet-900">
        <strong>Tips are not announcements.</strong> Daily log stays under Build. Tips hydrate your
        public page and community feed when you publish them.
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

      {composeMode === null ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setComposeMode('ai')}
            className="rounded-2xl border border-gray-200 bg-white p-4 text-left transition hover:border-orange-200 hover:bg-orange-50/50"
          >
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Sparkles className="h-4 w-4 text-violet-600" />
              Write with AI
            </span>
            <p className="mt-2 text-xs text-gray-600">
              Paste a rough idea or a structured tip — AI fills title, Big Idea, takeaway, and series
              items.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setComposeMode('manual')}
            className="rounded-2xl border border-gray-200 bg-white p-4 text-left transition hover:border-orange-200 hover:bg-orange-50/50"
          >
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
              <PenLine className="h-4 w-4 text-orange-600" />
              Write it myself
            </span>
            <p className="mt-2 text-xs text-gray-600">
              Blank title and body — evergreen advice your followers revisit.
            </p>
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => void createTip(e)}
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4"
        >
          <div className="flex flex-wrap gap-2">
            <ComposeModeTab
              label="Write with AI"
              active={composeMode === 'ai'}
              onClick={() => setComposeMode('ai')}
            />
            <ComposeModeTab
              label="Write it myself"
              active={composeMode === 'manual'}
              onClick={() => setComposeMode('manual')}
            />
          </div>

          <div className="flex items-start gap-2">
            <Lightbulb className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Add a tip</h4>
              <p className="text-xs text-gray-600 mt-1">
                Write something evergreen — fuel, health, routes, or how you think about training.
              </p>
            </div>
          </div>

          {composeMode === 'ai' ? (
            <div className="space-y-2 rounded-xl border border-violet-100 bg-violet-50/40 p-4">
              <label className="block text-xs font-semibold text-gray-700">
                Rough idea or structured tip…
              </label>
              <textarea
                value={aboutSeed}
                onChange={(e) => setAboutSeed(e.target.value)}
                rows={6}
                maxLength={8000}
                className="w-full rounded-lg border border-gray-300 p-3 text-sm bg-white font-mono text-[13px]"
                placeholder={`Rough idea: staying healthy during marathon prep\n\nOr paste structured content with Title, The Big Idea, The Takeaway, Tip Series, and numbered items.`}
              />
              <button
                type="button"
                disabled={drafting || !aboutSeed.trim()}
                onClick={() => void draftWithAi()}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {drafting ? 'Drafting…' : 'Draft tip'}
              </button>
            </div>
          ) : null}

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
            <span className="text-xs font-semibold text-gray-700">The Big Idea</span>
            <textarea
              value={draft.body}
              onChange={(e) => setDraft((prev) => ({ ...prev, body: e.target.value }))}
              rows={6}
              maxLength={8000}
              className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-sm"
              placeholder="Share the core insight your followers can come back to..."
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-700">The Takeaway (optional)</span>
            <textarea
              value={draft.takeaway}
              onChange={(e) => setDraft((prev) => ({ ...prev, takeaway: e.target.value }))}
              rows={3}
              maxLength={2000}
              className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-sm"
              placeholder="One line they should remember — sleep 8 hours, fuel within 30 minutes, etc."
            />
          </label>

          <fieldset className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
            <legend className="px-1 text-xs font-semibold text-gray-700">Tip series (optional)</legend>
            <label className="block">
              <span className="text-xs text-gray-600">Series title</span>
              <input
                value={draft.seriesTitle}
                onChange={(e) => setDraft((prev) => ({ ...prev, seriesTitle: e.target.value }))}
                maxLength={120}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                placeholder="Three fueling mistakes to avoid"
              />
            </label>
            <div className="space-y-2">
              {draft.seriesItems.map((item, index) => (
                <div key={index} className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                  <input
                    value={item.title}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        seriesItems: prev.seriesItems.map((row, i) =>
                          i === index ? { ...row, title: e.target.value } : row
                        ),
                      }))
                    }
                    maxLength={120}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold"
                    placeholder={`Item ${index + 1} title`}
                  />
                  <textarea
                    value={item.body}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        seriesItems: prev.seriesItems.map((row, i) =>
                          i === index ? { ...row, body: e.target.value } : row
                        ),
                      }))
                    }
                    rows={3}
                    maxLength={4000}
                    className="w-full rounded-lg border border-gray-300 p-3 text-sm"
                    placeholder="Short explanation"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        seriesItems: prev.seriesItems.filter((_, i) => i !== index),
                      }))
                    }
                    className="text-xs font-semibold text-red-600 hover:underline"
                  >
                    Remove item
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setDraft((prev) => ({
                  ...prev,
                  seriesItems: [...prev.seriesItems, { title: '', body: '' }],
                }))
              }
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              Add series item
            </button>
          </fieldset>

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

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-gray-700">Publish to</legend>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={draft.showOnLanding}
                onChange={(e) => setDraft((prev) => ({ ...prev, showOnLanding: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-orange-600"
              />
              Landing page
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={draft.showOnFeed}
                onChange={(e) => setDraft((prev) => ({ ...prev, showOnFeed: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-orange-600"
              />
              Feed (Community)
            </label>
          </fieldset>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              disabled={saving || !draft.title.trim() || !draft.body.trim()}
              onClick={() => void saveDraftOnly()}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              Save draft
            </button>
            <button
              type="submit"
              disabled={saving || !draft.title.trim() || !draft.body.trim()}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Publish tip'}
            </button>
          </div>
        </form>
      )}

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
          <p className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">
            Loading tips...
          </p>
        ) : tips.length > 0 ? (
          <div className="space-y-3">
            {tips.map((tip) => (
              <TipEditorCard key={tip.id} tip={tip} onSave={updateTip} onDelete={deleteTip} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
            No tips yet. Add your first durable thought above.
          </p>
        )}
      </section>
    </section>
  );
}

function ComposeModeTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
        active ? 'bg-orange-100 text-orange-900' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
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
        aria-label="The Big Idea"
      />

      <textarea
        value={draft.takeaway}
        onChange={(e) => setDraft((prev) => ({ ...prev, takeaway: e.target.value }))}
        rows={2}
        maxLength={2000}
        className="w-full rounded-lg border border-orange-200 bg-orange-50/40 p-3 text-sm"
        placeholder="The Takeaway (optional)"
        aria-label="The Takeaway"
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

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-gray-700">Publish to</legend>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={draft.showOnLanding}
            onChange={(e) => setDraft((prev) => ({ ...prev, showOnLanding: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300 text-orange-600"
          />
          Landing page
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={draft.showOnFeed}
            onChange={(e) => setDraft((prev) => ({ ...prev, showOnFeed: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300 text-orange-600"
          />
          Feed (Community)
        </label>
      </fieldset>

      <div className="flex justify-end">
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
