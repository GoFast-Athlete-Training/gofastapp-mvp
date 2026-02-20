import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/runs/ai-generate
 * Generate structured run data from unstructured blob input
 * 
 * Input: Raw text blob (copy/paste from web, Strava URL, unstructured text)
 * Output: Structured run data (title, date, time, location, miles, Strava URL, description, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { input } = body;

    if (!input || !input.trim()) {
      return NextResponse.json(
        { success: false, error: 'Input is required' },
        { status: 400 }
      );
    }

    // TODO: Implement AI parsing logic
    // For now, return a placeholder structure
    // This should:
    // 1. Parse unstructured text
    // 2. Extract: title, date, time, location, miles, Strava URL, description
    // 3. Return structured data
    
    // Placeholder: Basic parsing logic
    const inputLower = input.toLowerCase();
    
    // Try to extract Strava URL
    const stravaUrlMatch = input.match(/https?:\/\/(www\.)?strava\.com\/[^\s]+/i);
    const stravaUrl = stravaUrlMatch ? stravaUrlMatch[0] : null;
    
    // Try to extract date (basic patterns)
    const dateMatch = input.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})|(\d{4}-\d{2}-\d{2})/);
    let extractedDate = null;
    if (dateMatch) {
      try {
        const dateStr = dateMatch[0];
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          extractedDate = date.toISOString().split('T')[0];
        }
      } catch {}
    }
    
    // Try to extract time
    const timeMatch = input.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
    let extractedHour = null;
    let extractedMinute = null;
    let extractedPeriod = "AM";
    if (timeMatch) {
      extractedHour = timeMatch[1];
      extractedMinute = timeMatch[2];
      if (timeMatch[3]) {
        extractedPeriod = timeMatch[3].toUpperCase().startsWith('P') ? 'PM' : 'AM';
      }
    }
    
    // Try to extract miles
    const milesMatch = input.match(/(\d+\.?\d*)\s*(mile|mi|miles)/i);
    const extractedMiles = milesMatch ? milesMatch[1] : null;
    
    // Try to extract location (look for common location keywords)
    const locationKeywords = ['meet', 'start', 'location', 'at', 'address'];
    let extractedLocation = null;
    for (const keyword of locationKeywords) {
      const regex = new RegExp(`${keyword}[^\\n]*?([A-Z][^\\n]{10,})`, 'i');
      const match = input.match(regex);
      if (match) {
        extractedLocation = match[1].trim();
        break;
      }
    }
    
    // Extract title (first line or first sentence)
    const lines = input.split('\n').filter(l => l.trim());
    const extractedTitle = lines[0]?.trim() || null;
    
    // Description is the rest of the input (cleaned up)
    const extractedDescription = lines.slice(1).join('\n').trim() || input.trim();

    return NextResponse.json({
      success: true,
      runData: {
        title: extractedTitle,
        date: extractedDate,
        startTimeHour: extractedHour,
        startTimeMinute: extractedMinute,
        startTimePeriod: extractedPeriod,
        meetUpPoint: extractedLocation,
        totalMiles: extractedMiles,
        stravaMapUrl: stravaUrl,
        description: extractedDescription,
        source: stravaUrl ? 'Strava URL' : 'Web/Website',
        sourceUrl: stravaUrl || null,
      },
    });
  } catch (error: any) {
    console.error('AI generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate run data',
        details: error?.message,
      },
      { status: 500 }
    );
  }
}
