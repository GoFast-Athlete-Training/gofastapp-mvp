'use client';

import { useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { uploadImageFile } from '@/lib/client/uploadImages';

type Props = {
  coverPhotoUrl: string;
  onChange: (url: string) => void;
  onError?: (message: string | null) => void;
  className?: string;
};

/** Run cover photo for Links-style header — independent of route map. */
export default function CityRunCoverPhotoUploadField({
  coverPhotoUrl,
  onChange,
  onError,
  className = '',
}: Props) {
  const [uploading, setUploading] = useState(false);
  const trimmed = coverPhotoUrl.trim();

  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
        Cover photo <span className="font-normal text-gray-400">(optional)</span>
      </label>
      <p className="text-xs text-gray-500 mb-2">
        Shows at the top of your run page. Route map fills this spot only if you skip a cover.
      </p>
      {trimmed ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={trimmed}
            alt="Run cover"
            className="w-full max-w-md rounded-xl border border-gray-200 object-cover max-h-48"
          />
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-sm font-medium text-red-600 hover:text-red-800"
          >
            Remove cover photo
          </button>
        </div>
      ) : (
        <label className="block cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-4 hover:border-sky-400 hover:bg-sky-50/40 transition">
          <span className="flex items-center justify-center gap-2 text-sm text-gray-600">
            <ImageIcon className="h-4 w-4" />
            {uploading ? 'Uploading…' : 'Upload cover photo'}
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
