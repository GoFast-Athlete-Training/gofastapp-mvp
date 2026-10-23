'use client';

import { useState } from 'react';
import CityRunCoverPhotoUploadField from '@/components/cityruns/CityRunCoverPhotoUploadField';
import { RUNNING_EMOJIS } from '@/lib/run-profile-emoji-presets';

export const RUN_PROFILE_EMOJI_PRESETS = [
  '🏃',
  '🎂',
  '📍',
  '🏛️',
  '🌉',
  '☕',
  '👟',
  '🎉',
] as const;

type PartnerMark = {
  logoUrl: string;
  name: string;
  kind: "brand" | "club";
};

type Props = {
  profileEmoji: string;
  onProfileEmojiChange: (value: string) => void;
  coverPhotoUrl: string;
  onCoverPhotoUrlChange: (value: string) => void;
  onUploadError?: (message: string | null) => void;
  /** When set and emoji is blank, the public run circle uses this logo (Associate step). */
  partnerMark?: PartnerMark | null;
};

export default function CityRunProfileMetaFields({
  profileEmoji,
  onProfileEmojiChange,
  coverPhotoUrl,
  onCoverPhotoUrlChange,
  onUploadError,
  partnerMark = null,
}: Props) {
  const selected = profileEmoji.trim();
  const [gridOpen, setGridOpen] = useState(false);
  const [emojiOverrideOpen, setEmojiOverrideOpen] = useState(false);
  const usePartnerLogo = Boolean(partnerMark?.logoUrl) && !selected;
  const showEmojiPicker = !partnerMark?.logoUrl || emojiOverrideOpen || Boolean(selected);

  return (
    <div className="space-y-4 rounded-lg border border-sky-100 bg-gradient-to-b from-sky-50/80 to-white p-4">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Run look <span className="font-normal text-gray-400">(optional)</span>
        </p>
        {partnerMark?.logoUrl ? (
          <div className="mb-3 flex items-start gap-3 rounded-lg border border-sky-200 bg-white px-3 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={partnerMark.logoUrl}
              alt=""
              className="h-14 w-14 shrink-0 rounded-full border border-gray-200 object-contain bg-white p-1"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                {partnerMark.kind === "brand" ? "Brand logo" : "Club logo"}
              </p>
              <p className="text-sm text-gray-800">{partnerMark.name}</p>
              <p className="mt-1 text-xs text-gray-600">
                {usePartnerLogo
                  ? "This logo is the public circle mark (Links-style header) when no emoji override is set."
                  : "Emoji override is active — public page uses the emoji instead of this logo."}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-600 mb-3">
            Pick a cover photo below. For the small circle on the run page, link a club or brand on
            the Associate step — or choose an emoji override.
          </p>
        )}
        {showEmojiPicker ? (
        <>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onProfileEmojiChange('')}
            className={`flex h-10 min-w-10 items-center justify-center rounded-full border px-2 text-xs font-medium transition ${
              !selected
                ? 'border-sky-500 bg-sky-50 text-sky-900 ring-2 ring-sky-200'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            {partnerMark?.logoUrl ? "Partner logo" : "Default"}
          </button>
          {RUN_PROFILE_EMOJI_PRESETS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onProfileEmojiChange(emoji)}
              className={`flex h-10 w-10 items-center justify-center rounded-full border text-xl transition ${
                selected === emoji
                  ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-200'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
              aria-label={`Use ${emoji}`}
            >
              {emoji}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setGridOpen((v) => !v)}
            className="flex h-10 items-center justify-center rounded-full border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 hover:border-gray-300"
          >
            {gridOpen ? 'Hide more' : 'More emojis'}
          </button>
        </div>
        {gridOpen ? (
          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="grid grid-cols-8 gap-1.5 max-h-48 overflow-y-auto">
              {RUNNING_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onProfileEmojiChange(emoji)}
                  className={`flex h-10 w-full items-center justify-center rounded-lg text-2xl transition hover:bg-white hover:scale-105 ${
                    selected === emoji ? 'bg-sky-100 ring-2 ring-sky-300' : ''
                  }`}
                  aria-label={`Use ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <label className="mt-3 block">
          <span className="text-xs font-medium text-gray-700">Custom emoji</span>
          <input
            type="text"
            value={selected}
            onChange={(e) => onProfileEmojiChange(e.target.value.slice(0, 8))}
            placeholder="Or type one emoji"
            className="mt-1 w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </label>
        </>
        ) : (
          <button
            type="button"
            onClick={() => setEmojiOverrideOpen(true)}
            className="text-xs font-medium text-sky-800 underline hover:text-sky-950"
          >
            Override with emoji instead
          </button>
        )}
      </div>

      <CityRunCoverPhotoUploadField
        coverPhotoUrl={coverPhotoUrl}
        onChange={onCoverPhotoUrlChange}
        onError={onUploadError}
      />
    </div>
  );
}
