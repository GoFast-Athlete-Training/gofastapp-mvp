'use client';

import { useState } from 'react';
import { Share2, Check } from 'lucide-react';

type Props = {
  handle: string | null;
  displayName: string;
};

export default function ShareButton({ handle, displayName }: Props) {
  const [copied, setCopied] = useState(false);

  async function onShare() {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/u/${handle ?? ''}`;
    const shareData = {
      title: `${displayName} on GoFast`,
      text: `Check out ${displayName} on GoFast`,
      url,
    };

    const nav = window.navigator as Navigator & {
      share?: (data: ShareData) => Promise<void>;
    };

    try {
      if (nav.share) {
        await nav.share(shareData);
        return;
      }
    } catch {
      // user cancelled or share failed — fall through to clipboard
    }

    try {
      await window.navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available — silent
    }
  }

  return (
    <button
      type="button"
      onClick={onShare}
      aria-label="Share profile"
      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/95 text-stone-800 hover:bg-white px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm transition-colors"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-600" />
          Copied
        </>
      ) : (
        <>
          <Share2 className="w-3.5 h-3.5" />
          Share
        </>
      )}
    </button>
  );
}
