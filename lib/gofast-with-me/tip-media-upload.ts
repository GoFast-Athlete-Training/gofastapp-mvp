import type { AthleteTipMediaType } from '@/lib/gofast-with-me/athlete-tips';

export type TipMediaDraft = {
  mediaUrl: string | null;
  mediaType: AthleteTipMediaType | null;
};

export async function uploadTipMedia(file: File): Promise<TipMediaDraft> {
  const formData = new FormData();
  formData.append('file', file);

  const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
  const uploadData = (await uploadRes.json()) as {
    url?: string;
    mediaType?: AthleteTipMediaType;
    error?: string;
  };

  if (!uploadRes.ok || !uploadData.url) {
    throw new Error(uploadData.error || 'Media upload failed');
  }

  return {
    mediaUrl: uploadData.url,
    mediaType: uploadData.mediaType ?? (file.type.startsWith('video/') ? 'video' : 'image'),
  };
}

export function tipMediaAccept(): string {
  return 'image/*,video/mp4,video/webm';
}
