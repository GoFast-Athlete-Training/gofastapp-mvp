export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

// GET - Get a single TrainingSchema by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const trainingSchema = await prisma.trainingSchema.findUnique({
      where: { id },
    });

    if (!trainingSchema) {
      return NextResponse.json(
        { success: false, error: 'TrainingSchema not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: trainingSchema });
  } catch (error: any) {
    console.error('❌ Error fetching TrainingSchema:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch training schema', details: error?.message },
      { status: 500 }
    );
  }
}

// PUT - Update a TrainingSchema record
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();
    const { name, description, schemaJson } = body;

    if (!name || !schemaJson) {
      return NextResponse.json(
        { success: false, error: 'Name and schemaJson are required' },
        { status: 400 }
      );
    }

    // Validate JSON
    if (typeof schemaJson !== 'object') {
      return NextResponse.json(
        { success: false, error: 'schemaJson must be a valid JSON object' },
        { status: 400 }
      );
    }

    const trainingSchema = await prisma.trainingSchema.update({
      where: { id },
      data: {
        name,
        description: description || null,
        schemaJson,
      },
    });

    return NextResponse.json({ success: true, data: trainingSchema });
  } catch (error: any) {
    console.error('❌ Error updating TrainingSchema:', error);

    if (error.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'TrainingSchema not found' },
        { status: 404 }
      );
    }

    if (error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'A TrainingSchema with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to update training schema', details: error?.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete a TrainingSchema record
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    await prisma.trainingSchema.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'TrainingSchema deleted successfully' });
  } catch (error: any) {
    console.error('❌ Error deleting TrainingSchema:', error);

    if (error.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'TrainingSchema not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to delete training schema', details: error?.message },
      { status: 500 }
    );
  }
}
