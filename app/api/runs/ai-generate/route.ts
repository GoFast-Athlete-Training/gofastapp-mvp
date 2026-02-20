import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/runs/ai-generate
 * Generate structured run data from multiple source inputs
 * 
 * Input: All available source inputs (stravaUrl, stravaText, webUrl, webText, igPostText, igPostGraphic)
 * Output: Structured run data (title, date, time, location, miles, Strava URL, description, etc.)
 * 
 * AI uses ALL sources together for better extraction. Raw sources are stored for founder review.
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
    const {
      stravaUrl,
      stravaText,
      webUrl,
      webText,
      igPostText,
      igPostGraphic,
    } = body;

    // Combine all text sources for AI processing
    const allTextSources: string[] = [];
    if (stravaText?.trim()) allTextSources.push(`[STRAVA TEXT]\n${stravaText.trim()}`);
    if (webText?.trim()) allTextSources.push(`[WEB TEXT]\n${webText.trim()}`);
    if (igPostText?.trim()) allTextSources.push(`[IG POST TEXT]\n${igPostText.trim()}`);
    if (stravaUrl?.trim()) allTextSources.push(`[STRAVA URL]\n${stravaUrl.trim()}`);
    if (webUrl?.trim()) allTextSources.push(`[WEB URL]\n${webUrl.trim()}`);
    
    const combinedInput = allTextSources.join('\n\n---\n\n');
    
    if (!combinedInput.trim()) {
      return NextResponse.json(
        { success: false, error: 'At least one source input is required' },
        { status: 400 }
      );
    }

    // TODO: Implement AI parsing logic (LLM integration)
    // For now, basic regex parsing combining all sources
    const inputLower = combinedInput.toLowerCase();
    
    // Try to extract Strava URL (from stravaUrl field or text)
    const stravaUrlFromText = combinedInput.match(/https?:\/\/(www\.)?strava\.com\/[^\s]+/i);
    const extractedStravaUrl = stravaUrl?.trim() || (stravaUrlFromText ? stravaUrlFromText[0] : null);
    
    // Try to extract date (basic patterns) - check all sources
    const dateMatch = combinedInput.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})|(\d{4}-\d{2}-\d{2})/);
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
    
    // Try to extract time - check all sources
    const timeMatch = combinedInput.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
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
    
    // Try to extract miles - check all sources
    const milesMatch = combinedInput.match(/(\d+\.?\d*)\s*(mile|mi|miles)/i);
    const extractedMiles = milesMatch ? milesMatch[1] : null;
    
    // Try to extract location - check all sources
    const locationKeywords = ['meet', 'start', 'location', 'at', 'address'];
    let extractedLocation = null;
    for (const keyword of locationKeywords) {
      const regex = new RegExp(`${keyword}[^\\n]*?([A-Z][^\\n]{10,})`, 'i');
      const match = combinedInput.match(regex);
      if (match) {
        extractedLocation = match[1].trim();
        break;
      }
    }
    
    // Extract title (first line or first sentence from any source)
    const lines = combinedInput.split('\n').filter(l => l.trim() && !l.startsWith('['));
    const extractedTitle = lines[0]?.trim() || null;
    
    // Description combines all text sources (cleaned up)
    const extractedDescription = lines.slice(1).join('\n').trim() || combinedInput.trim();

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
        stravaMapUrl: extractedStravaUrl,
        description: extractedDescription,
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
