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
  heading?: string;
  hint?: string;
  addPhotosLabel?: string;
};

export default function CityRunRoutePhotosField({
  photos,
  onChange,
  onError,
  className = '',
  heading = 'Route photos',
  hint = 'Up to {max} extra images.',
  addPhotosLabel = 'Add photos',
}: Props) {
  const [uploading, setUploading] = useState(false);

  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
        {heading} <span className="font-normal text-gray-400">(optional)</span>
      </label>
      <p className="text-xs text-gray-500 mb-2">
        {hint.replace("{max}", String(MAX_ROUTE_PHOTOS))}
      </p>
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
              {uploading ? 'Uploading…' : addPhotosLabel}
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
    </div>
  );
}
