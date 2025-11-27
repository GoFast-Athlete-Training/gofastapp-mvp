import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseIdToken } from '@/lib/firebaseAdmin';
import { getCrewById } from '@/lib/domain-runcrew';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    await verifyFirebaseIdToken(token);

    const crew = await getCrewById(params.id);
    if (!crew) {
      return NextResponse.json({ error: 'Crew not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, runCrew: crew });
  } catch (error: any) {
    console.error('Error getting crew:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get crew' },
      { status: 500 }
    );
  }
}

