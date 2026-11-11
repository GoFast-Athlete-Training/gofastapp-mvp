"use client";

import { useState } from "react";
import { ImageIcon, X } from "lucide-react";
import { uploadImageFile } from "@/lib/client/uploadImages";

type Props = {
  coverPhotoUrl: string;
  onChange: (url: string) => void;
  onError?: (msg: string | null) => void;
};

/** Staff dashboard — optional cover under description without the Run look panel. */
export default function RunManageDiscreetBannerField({
  coverPhotoUrl,
  onChange,
  onError,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const trimmed = coverPhotoUrl.trim();

  if (trimmed) {
    return (
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={trimmed}
          alt=""
          className="h-14 w-24 shrink-0 rounded-md border border-gray-200 object-cover"
        />
        <div className="flex flex-wrap gap-2 text-xs">
          <label className="cursor-pointer font-medium text-sky-700 hover:text-sky-900">
            Change banner
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                try {
                  onChange(await uploadImageFile(file));
                } catch (err) {
                  onError?.(err instanceof Error ? err.message : "Upload failed.");
                } finally {
                  setUploading(false);
                  e.target.value = "";
                }
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => onChange("")}
            className="inline-flex items-center gap-0.5 font-medium text-gray-500 hover:text-red-600"
          >
            <X className="h-3 w-3" />
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-gray-500 hover:text-sky-700">
      <ImageIcon className="h-3.5 w-3.5" />
      {uploading ? "Uploading…" : "Add banner (optional)"}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        disabled={uploading}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setUploading(true);
          try {
            onChange(await uploadImageFile(file));
          } catch (err) {
            onError?.(err instanceof Error ? err.message : "Upload failed.");
          } finally {
            setUploading(false);
            e.target.value = "";
          }
        }}
      />
    </label>
  );
}
