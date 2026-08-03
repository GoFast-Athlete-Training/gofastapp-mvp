import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const VIDEO_MAX_BYTES = 50 * 1024 * 1024;

function isMultipartParseError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('Unexpected end of form') ||
    message.includes('Failed to parse body as FormData') ||
    message.includes('missing boundary') ||
    message.includes('Malformed content type')
  );
}

function resolveUploadKind(mimeType: string): 'image' | 'video' | null {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'video/mp4' || mimeType === 'video/webm') return 'video';
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const kind = resolveUploadKind(file.type);
    if (!kind) {
      return NextResponse.json(
        { error: 'File must be an image or video (mp4/webm)' },
        { status: 400 }
      );
    }

    const maxBytes = kind === 'image' ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES;
    if (file.size > maxBytes) {
      const maxMb = Math.round(maxBytes / (1024 * 1024));
      return NextResponse.json(
        { error: `File size must be less than ${maxMb}MB` },
        { status: 400 }
      );
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: 'BLOB_READ_WRITE_TOKEN not configured' },
        { status: 500 }
      );
    }

    const blob = await put(file.name, file, {
      access: 'public',
      addRandomSuffix: true,
      token,
    });

    return NextResponse.json({
      success: true,
      url: blob.url,
      mediaType: kind,
    });
  } catch (error: unknown) {
    console.error('Upload error:', error);
    if (isMultipartParseError(error)) {
      return NextResponse.json(
        { error: 'Invalid or incomplete upload. Please try again.' },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : 'Failed to upload file';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
