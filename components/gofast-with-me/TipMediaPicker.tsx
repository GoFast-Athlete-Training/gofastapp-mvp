'use client';

import { ExternalLink, Instagram, X } from 'lucide-react';
import type { AthleteTipMediaType } from '@/lib/gofast-with-me/athlete-tips';
import type { TipMediaDraft } from '@/lib/gofast-with-me/tip-media-upload';
import { tipMediaAccept, uploadTipMedia } from '@/lib/gofast-with-me/tip-media-upload';

type Props = {
  mediaUrl: string | null;
  mediaType: AthleteTipMediaType | null;
  onChange: (next: TipMediaDraft) => void;
  disabled?: boolean;
};

export default function TipMediaPicker({ mediaUrl, mediaType, onChange, disabled = false }: Props) {
  const handleFile = async (file: File | null) => {
    if (!file || disabled) return;
    try {
      const uploaded = await uploadTipMedia(file);
      onChange(uploaded);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Media upload failed';
      window.alert(message);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-gray-700">Photo or video (optional)</span>
        {mediaUrl ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange({ mediaUrl: null, mediaType: null })}
            className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-red-600 disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            Remove media
          </button>
        ) : null}
      </div>

      {mediaUrl ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
          {mediaType === 'video' ? (
            <video src={mediaUrl} controls className="max-h-64 w-full bg-black" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl} alt="" className="max-h-64 w-full object-cover" />
          )}
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center hover:border-orange-300 hover:bg-orange-50/40">
          <input
            type="file"
            accept={tipMediaAccept()}
            disabled={disabled}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              void handleFile(file);
              e.target.value = '';
            }}
          />
          <span className="text-sm font-semibold text-gray-800">Add photo or short video</span>
          <span className="mt-1 text-xs text-gray-500">
            Images up to 5MB · mp4/webm up to 50MB
          </span>
        </label>
      )}
    </div>
  );
}

type InstagramLinkProps = {
  username?: string | null;
  className?: string;
};

/** Outbound @handle only — no empty IG stream block. */
export function AthleteInstagramHandleLink({ username, className = '' }: InstagramLinkProps) {
  const handle = username?.replace(/^@/, '').trim();
  if (!handle) return null;

  return (
    <p className={`text-sm text-gray-600 ${className}`.trim()}>
      <a
        href={`https://www.instagram.com/${handle}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 font-semibold text-pink-700 hover:underline"
      >
        <Instagram className="h-4 w-4" />
        @{handle}
        <ExternalLink className="h-3.5 w-3.5 opacity-70" />
      </a>
    </p>
  );
}
