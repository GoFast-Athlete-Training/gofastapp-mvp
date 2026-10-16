'use client';

import { useState } from 'react';
import { ImageIcon, X } from 'lucide-react';
import {
  MAX_ROUTE_PHOTOS,
  pickRoutePhotoFiles,
  uploadImageFiles,
} from '@/lib/client/uploadImages';

type Props = {
  photos: string[];
  onChange: (photos: string[]) => void;
  onError?: (message: string | null) => void;
  className?: string;
};

export default function CityRunRoutePhotosField({
  photos,
  onChange,
  onError,
  className = '',
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');

  function addUrlPhoto() {
    const url = urlDraft.trim();
    if (!url || photos.length >= MAX_ROUTE_PHOTOS) return;
    try {
      // eslint-disable-next-line no-new
      new URL(url);
    } catch {
      onError?.('Enter a valid image URL.');
      return;
    }
    onChange([...photos, url]);
    setUrlDraft('');
    onError?.(null);
  }

  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
        Route photos <span className="font-normal text-gray-400">(optional)</span>
      </label>
      <p className="text-xs text-gray-500 mb-2">Up to {MAX_ROUTE_PHOTOS} extra images.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {photos.map((photo, index) => (
          <div key={`${photo}-${index}`} className="group relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt={`Route photo ${index + 1}`}
              className="aspect-video w-full rounded-lg border border-gray-200 object-cover bg-gray-100"
            />
            <button
              type="button"
              onClick={() => onChange(photos.filter((_, i) => i !== index))}
              className="absolute right-1 top-1 rounded-full bg-red-500 p-1 text-white opacity-90 sm:opacity-0 sm:group-hover:opacity-100"
              aria-label="Remove photo"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {photos.length < MAX_ROUTE_PHOTOS ? (
          <label className="flex aspect-video cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 hover:border-orange-400 hover:bg-orange-50/50">
            <ImageIcon className="h-6 w-6 text-gray-400" />
            <span className="text-xs text-gray-600 px-2 text-center">
              {uploading ? 'Uploading…' : 'Add photos'}
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={async (e) => {
                const { files, skipped } = pickRoutePhotoFiles(e.target.files, photos.length);
                if (files.length === 0) return;
                setUploading(true);
                onError?.(null);
                try {
                  const urls = await uploadImageFiles(files);
                  onChange([...photos, ...urls]);
                  if (skipped > 0) {
                    onError?.(
                      `Only ${MAX_ROUTE_PHOTOS} route photos allowed — ${skipped} skipped.`
                    );
                  }
                } catch (err) {
                  onError?.(err instanceof Error ? err.message : 'Upload failed.');
                } finally {
                  setUploading(false);
                  e.target.value = '';
                }
              }}
            />
          </label>
        ) : null}
      </div>
      {photos.length < MAX_ROUTE_PHOTOS ? (
        <div className="mt-2 flex gap-2">
          <input
            type="url"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            placeholder="Or paste image URL"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={addUrlPhoto}
            disabled={!urlDraft.trim() || uploading}
            className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      ) : null}
    </div>
  );
}
