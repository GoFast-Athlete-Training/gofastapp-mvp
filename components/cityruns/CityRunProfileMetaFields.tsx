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

type Props = {
  profileEmoji: string;
  onProfileEmojiChange: (value: string) => void;
  coverPhotoUrl: string;
  onCoverPhotoUrlChange: (value: string) => void;
  onUploadError?: (message: string | null) => void;
};

export default function CityRunProfileMetaFields({
  profileEmoji,
  onProfileEmojiChange,
  coverPhotoUrl,
  onCoverPhotoUrlChange,
  onUploadError,
}: Props) {
  const selected = profileEmoji.trim();
  const [gridOpen, setGridOpen] = useState(false);

  return (
    <div className="space-y-4 rounded-lg border border-sky-100 bg-gradient-to-b from-sky-50/80 to-white p-4">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Run look <span className="font-normal text-gray-400">(optional)</span>
        </p>
        <p className="text-xs text-gray-600 mb-3">
          Like GoFast Links — pick an emoji for the circle, or leave blank to use your photo or club
          logo on the run page.
        </p>
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
            Auto
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
      </div>

      <CityRunCoverPhotoUploadField
        coverPhotoUrl={coverPhotoUrl}
        onChange={onCoverPhotoUrlChange}
        onError={onUploadError}
      />
    </div>
  );
}
