'use client';

import { useCallback, useRef, useState } from 'react';
import {
  clampPhotoFocus,
  DEFAULT_PHOTO_FOCUS,
  photoFocusObjectPosition,
  type PhotoFocus,
} from '@/lib/gofast-with-me/photo-focus';
import {
  isPortraitPhotoType,
  widePhotoFrameClass,
  widePhotoFrameShellClass,
  type GoFastWithMePhotoType,
} from '@/lib/gofast-with-me/photo-type';

type Props = {
  src: string;
  focusX: number;
  focusY: number;
  photoType?: GoFastWithMePhotoType | string | null;
  onFocusChange: (focus: PhotoFocus) => void;
};

export default function RunImageFocalPicker({
  src,
  focusX,
  focusY,
  photoType,
  onFocusChange,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const setFocusFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const frame = frameRef.current;
      if (!frame) return;
      const rect = frame.getBoundingClientRect();
      const x = clampPhotoFocus(((clientX - rect.left) / rect.width) * 100);
      const y = clampPhotoFocus(((clientY - rect.top) / rect.height) * 100);
      onFocusChange({ x, y });
    },
    [onFocusChange]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
    frameRef.current?.setPointerCapture(e.pointerId);
    setFocusFromPointer(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setFocusFromPointer(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setDragging(false);
    frameRef.current?.releasePointerCapture(e.pointerId);
  };

  const objectPosition = photoFocusObjectPosition({ x: focusX, y: focusY });
  const portrait = isPortraitPhotoType(photoType);
  const frameClass = portrait
    ? 'relative w-36 aspect-square mx-auto rounded-xl overflow-hidden bg-sky-100 border border-gray-200 cursor-crosshair touch-none select-none'
    : `relative w-full ${widePhotoFrameClass('studioPreview')} ${widePhotoFrameShellClass('studioPreview')} cursor-crosshair touch-none select-none`;

  return (
    <div className="space-y-2">
      <div
        ref={frameRef}
        className={frameClass}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        role="presentation"
      >
        <img
          src={src}
          alt="Run image preview"
          className="w-full h-full object-cover pointer-events-none"
          style={{ objectPosition }}
          draggable={false}
        />
        <div
          className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-white bg-orange-500 shadow-md pointer-events-none"
          style={{ left: `${focusX}%`, top: `${focusY}%` }}
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-3 py-2 pointer-events-none">
          <p className="text-[11px] text-white/90">
            Click or drag to set the focal point — original image is kept.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          Focus {focusX}%, {focusY}%
        </span>
        {(focusX !== DEFAULT_PHOTO_FOCUS || focusY !== DEFAULT_PHOTO_FOCUS) && (
          <button
            type="button"
            onClick={() => onFocusChange({ x: DEFAULT_PHOTO_FOCUS, y: DEFAULT_PHOTO_FOCUS })}
            className="font-medium text-orange-600 hover:text-orange-700"
          >
            Reset to center
          </button>
        )}
      </div>
    </div>
  );
}
