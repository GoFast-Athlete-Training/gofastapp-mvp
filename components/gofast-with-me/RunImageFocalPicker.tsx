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

type DragOrigin = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startFocusX: number;
  startFocusY: number;
};

/**
 * Drag pans the crop (object-position). Dragging the photo right reveals more of the left edge.
 */
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
  const dragRef = useRef<DragOrigin | null>(null);
  const [dragging, setDragging] = useState(false);

  const applyPan = useCallback(
    (clientX: number, clientY: number) => {
      const drag = dragRef.current;
      const frame = frameRef.current;
      if (!drag || !frame) return;
      const rect = frame.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const z = clampPhotoZoom(zoom);
      // Higher zoom → same pixel drag covers more of the focus range.
      const sensitivity = 100 / z;
      const nextX = clampPhotoFocus(
        drag.startFocusX - ((clientX - drag.startClientX) / rect.width) * sensitivity
      );
      const nextY = clampPhotoFocus(
        drag.startFocusY - ((clientY - drag.startClientY) / rect.height) * sensitivity
      );
      onFocusChange({ x: nextX, y: nextY });
    },
    [onFocusChange, zoom]
  );

  const endDrag = useCallback((pointerId?: number) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (pointerId != null && drag.pointerId !== pointerId) return;
    dragRef.current = null;
    setDragging(false);
    try {
      frameRef.current?.releasePointerCapture(drag.pointerId);
    } catch {
      /* already released */
    }
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startFocusX: focusX,
      startFocusY: focusY,
    };
    setDragging(true);
    frameRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    e.preventDefault();
    applyPan(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    endDrag(e.pointerId);
  };

  const frameStyle = photoFrameStyle(focusX, focusY, zoom);
  const portrait = isPortraitPhotoType(photoType);
  const frameClass = portrait
    ? 'relative w-36 aspect-square rounded-xl overflow-hidden bg-sky-100 border border-gray-200 touch-none select-none'
    : `relative w-full ${widePhotoFrameClass('studioPreview')} ${widePhotoFrameShellClass('studioPreview')} touch-none select-none`;

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
    <div className="space-y-3 max-w-md">
      <div
        ref={frameRef}
        className={`${frameClass} ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="img"
        aria-label="Drag to reposition run image crop"
      >
        <img
          src={src}
          alt="Run image preview"
          className="w-full h-full object-cover pointer-events-none"
          style={frameStyle}
          draggable={false}
        />
        <div
          className="absolute w-3.5 h-3.5 -ml-[7px] -mt-[7px] rounded-full border-2 border-white bg-orange-500 shadow-md pointer-events-none"
          style={{ left: `${focusX}%`, top: `${focusY}%` }}
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-3 py-2 pointer-events-none">
          <p className="text-[11px] text-white/95">
            Drag to move · use zoom to tighten — same crop as your public page.
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
          Zoom in to cut empty space, then drag the photo to frame what you want.
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
