'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Building2, ImagePlus, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import type { AthleteCompanyRecord } from '@/lib/athlete-company/athlete-company-service';

type Props = {
  onSaved?: (company: AthleteCompanyRecord) => void;
};

export default function GoFastWithMeCompanyPanel({ onSaved }: Props) {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/me/athlete-company');
      const company = res.data?.company as AthleteCompanyRecord | null;
      if (company) {
        setName(company.name ?? '');
        setWebsiteUrl(company.websiteUrl ?? '');
        setLogoPreview(company.logoUrl ?? null);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error || e.message || 'Could not load your business');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function uploadFile(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
    const uploadData = (await uploadRes.json()) as {
      success?: boolean;
      url?: string;
      error?: string;
    };
    if (!uploadRes.ok || !uploadData.url) {
      throw new Error(uploadData.error || 'Logo upload failed');
    }
    return uploadData.url;
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('Business name is required');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      let logoUrl = logoPreview?.startsWith('blob:') ? null : logoPreview?.trim() || null;
      if (pendingLogoFile) {
        logoUrl = await uploadFile(pendingLogoFile);
      }

      const res = await api.patch('/me/athlete-company', {
        name: name.trim(),
        websiteUrl: websiteUrl.trim() || null,
        logoUrl,
      });
      if (!res.data?.success) {
        throw new Error(res.data?.error || 'Could not save your business');
      }

      const company = res.data.company as AthleteCompanyRecord;
      setLogoPreview(company.logoUrl ?? null);
      setPendingLogoFile(null);
      onSaved?.(company);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error || e.message || 'Could not save your business');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-violet-200 bg-violet-50/40 p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your business…
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50/40 p-5 sm:p-6 shadow-sm space-y-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-violet-100 p-2">
          <Building2 className="h-5 w-5 text-violet-700" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Your business</h2>
          <p className="text-sm text-gray-600 mt-1">
            Name and logo for the coaching or training business you represent on GoFast With Me.
            This is your stated affiliation — not a verified directory listing.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => logoInputRef.current?.click()}
          className="relative h-20 w-20 rounded-xl border border-dashed border-violet-300 bg-white flex items-center justify-center overflow-hidden hover:border-violet-400"
        >
          {logoPreview ? (
            <Image src={logoPreview} alt="" fill className="object-cover" unoptimized />
          ) : (
            <ImagePlus className="h-6 w-6 text-violet-400" />
          )}
        </button>
        <input
          ref={logoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setPendingLogoFile(file);
            setLogoPreview(URL.createObjectURL(file));
            e.target.value = '';
          }}
        />
        <p className="text-xs text-gray-500 max-w-xs">
          Upload a square logo. It appears on your public GoFast With Me page.
        </p>
      </div>

      <div>
        <label htmlFor="company-name" className="block text-sm font-medium text-gray-700 mb-1">
          Business name
        </label>
        <input
          id="company-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="e.g. DC Endurance Coaching"
        />
      </div>

      <div>
        <label htmlFor="company-website" className="block text-sm font-medium text-gray-700 mb-1">
          Website <span className="font-normal text-gray-500">(optional)</span>
        </label>
        <input
          id="company-website"
          type="url"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="https://yourcoachingbusiness.com"
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : saved ? (
          'Saved'
        ) : (
          'Save business'
        )}
      </button>
    </section>
  );
}
