export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

// GET - List all TrainingSchema records
export async function GET(request: Request) {
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
  try {
    const trainingSchemas = await prisma.trainingSchema.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: trainingSchemas });
  } catch (error: any) {
    console.error('❌ Error fetching TrainingSchemas:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch training schemas', details: error?.message },
      { status: 500 }
    );
  }
}

// POST - Create a new TrainingSchema record
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

    const trainingSchema = await prisma.trainingSchema.create({
      data: {
        name,
        description: description || null,
        schemaJson,
      },
    });

    return NextResponse.json({ success: true, data: trainingSchema }, { status: 201 });
  } catch (error: any) {
    console.error('❌ Error creating TrainingSchema:', error);
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'A TrainingSchema with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create training schema', details: error?.message },
      { status: 500 }
    );
  }
}
