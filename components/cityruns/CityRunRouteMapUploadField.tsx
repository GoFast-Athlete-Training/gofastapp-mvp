'use client';

import { useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { uploadImageFile } from '@/lib/client/uploadImages';

type Props = {
  mapImageUrl: string;
  onChange: (url: string) => void;
  onError?: (message: string | null) => void;
  className?: string;
};

/** Club RunInstanceWizard parity — Strava map screenshot → city_runs.mapImageUrl */
export default function CityRunRouteMapUploadField({
  mapImageUrl,
  onChange,
  onError,
  className = '',
}: Props) {
  const [uploading, setUploading] = useState(false);
  const trimmed = mapImageUrl.trim();

  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
        Route map <span className="font-normal text-gray-400">(optional)</span>
      </label>
      <p className="text-xs text-gray-500 mb-2">Upload a Strava map screenshot.</p>
      {trimmed ? (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={trimmed}
            alt="Route map"
            className="w-full max-w-md rounded-lg border border-gray-200 object-cover"
          />
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-sm font-medium text-red-600 hover:text-red-800 shrink-0"
          >
            Remove
          </button>
        </div>
      ) : (
        <label className="block cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-4 hover:border-orange-400 hover:bg-orange-50/40 transition">
          <span className="flex items-center justify-center gap-2 text-sm text-gray-600">
            <ImageIcon className="h-4 w-4" />
            {uploading ? 'Uploading…' : 'Upload Strava map screenshot'}
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(true);
              onError?.(null);
              try {
                onChange(await uploadImageFile(file));
              } catch (err) {
                onError?.(err instanceof Error ? err.message : 'Upload failed.');
              } finally {
                setUploading(false);
                e.target.value = '';
              }
            }}
          />
        </label>
      )}
    </div>
  );
}
