export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { upsertDefaultTrainingSchema } from '@/lib/training-schema';

// POST - Upsert the default TrainingSchema record
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
      await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch (err: any) {
      console.error('❌ TRAINING SCHEMA: Token verification failed:', err?.message);
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }
    const trainingSchema = await upsertDefaultTrainingSchema();
    return NextResponse.json({ success: true, data: trainingSchema });
  } catch (error: any) {
    console.error('❌ Error upserting default TrainingSchema:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upsert default training schema', details: error?.message },
      { status: 500 }
    );
  }
}
