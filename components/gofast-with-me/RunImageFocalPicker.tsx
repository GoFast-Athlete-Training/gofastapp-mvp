'use client';

import { useCallback, useRef, useState } from 'react';
import {
  clampPhotoFocus,
  clampPhotoZoom,
  DEFAULT_PHOTO_FOCUS,
  DEFAULT_PHOTO_ZOOM,
  MAX_PHOTO_ZOOM,
  MIN_PHOTO_ZOOM,
  photoFrameStyle,
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
  zoom: number;
  photoType?: GoFastWithMePhotoType | string | null;
  onFocusChange: (focus: PhotoFocus) => void;
  onZoomChange: (zoom: number) => void;
};

export default function RunImageFocalPicker({
  src,
  focusX,
  focusY,
  zoom,
  photoType,
  onFocusChange,
  onZoomChange,
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

  const frameStyle = photoFrameStyle(focusX, focusY, zoom);
  const portrait = isPortraitPhotoType(photoType);
  const frameClass = portrait
    ? 'relative w-36 aspect-square mx-auto rounded-xl overflow-hidden bg-sky-100 border border-gray-200 cursor-crosshair touch-none select-none'
    : `relative w-full ${widePhotoFrameClass('studioPreview')} ${widePhotoFrameShellClass('studioPreview')} cursor-crosshair touch-none select-none`;

  const isDefaultFrame =
    focusX === DEFAULT_PHOTO_FOCUS &&
    focusY === DEFAULT_PHOTO_FOCUS &&
    clampPhotoZoom(zoom) <= MIN_PHOTO_ZOOM;
  const showZoomHint = clampPhotoZoom(zoom) <= MIN_PHOTO_ZOOM + 0.05;

  const handleReset = () => {
    onFocusChange({ x: DEFAULT_PHOTO_FOCUS, y: DEFAULT_PHOTO_FOCUS });
    onZoomChange(DEFAULT_PHOTO_ZOOM);
  };

  return (
    <div className="space-y-3">
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
          style={frameStyle}
          draggable={false}
        />
        <div
          className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-white bg-orange-500 shadow-md pointer-events-none"
          style={{ left: `${focusX}%`, top: `${focusY}%` }}
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-3 py-2 pointer-events-none">
          <p className="text-[11px] text-white/90">
            Drag to reposition · zoom to tighten — original image is kept.
          </p>
        </div>
      </div>

      <label className="block space-y-1.5">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span className="font-medium text-gray-800">Zoom</span>
          <span>{clampPhotoZoom(zoom).toFixed(1)}×</span>
        </div>
        <input
          type="range"
          min={MIN_PHOTO_ZOOM}
          max={MAX_PHOTO_ZOOM}
          step={0.1}
          value={clampPhotoZoom(zoom)}
          onChange={(e) => onZoomChange(clampPhotoZoom(Number(e.target.value)))}
          className="w-full accent-orange-500"
          aria-label="Photo zoom"
        />
      </label>

      {showZoomHint ? (
        <p className="text-xs text-gray-500">
          Zoom in to cut empty space above or below, then drag to reposition.
        </p>
      ) : null}

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          Focus {focusX}%, {focusY}% · {clampPhotoZoom(zoom).toFixed(1)}×
        </span>
        {!isDefaultFrame ? (
          <button
            type="button"
            onClick={handleReset}
            className="font-medium text-orange-600 hover:text-orange-700"
          >
            Reset framing
          </button>
        ) : null}
      </div>
    </div>
  );
}
