import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST /api/runs/ai-generate
 * Generate structured run data from multiple source inputs
 * 
 * Input: All available source inputs (stravaUrl, stravaText, webUrl, webText, igPostText, igPostGraphic, runClubId)
 * Output: Structured run data (title, date, time, location, miles, pace, postRunActivity, Strava URL, description, etc.)
 * 
 * AI uses ALL sources together for better extraction. Raw sources are stored for founder review.
 * Can infer city/neighborhood from runClubId if provided.
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
      runClubId,
    } = body;

    // Fetch run club city if runClubId provided (for inference)
    let runClubCity: string | null = null;
    if (runClubId) {
      try {
        const runClub = await prisma.run_clubs.findUnique({
          where: { id: runClubId },
          select: { city: true },
        });
        runClubCity = runClub?.city || null;
      } catch (error) {
        console.error('Error fetching run club:', error);
        // Continue without city inference
      }
    }

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
    
    // Try to extract meet up point - improved patterns
    // Patterns: "meets at X", "starts at X", "meetup at X", "meet at X", "location: X"
    const meetUpPatterns = [
      /(?:meets?|meetup|start|gather|location)[\s:]+(?:at|@|in|near)?[\s:]+([A-Z][^.\n]{5,}?)(?:\.|,|\n|$)/i,
      /(?:meet|start|location)[\s:]+([A-Z][^.\n]{5,}?)(?:\.|,|\n|$)/i,
      /at[\s]+([A-Z][^.\n]{5,}?)(?:\.|,|\n|$)/i,
    ];
    
    let extractedLocation = null;
    for (const pattern of meetUpPatterns) {
      const match = combinedInput.match(pattern);
      if (match && match[1]) {
        extractedLocation = match[1].trim();
        // Clean up common trailing words
        extractedLocation = extractedLocation.replace(/\s+(and|or|before|after|then|to|does|miles).*$/i, '').trim();
        if (extractedLocation.length > 5) {
          break;
        }
      }
    }
    
    // Extract city - infer from run club if available
    let extractedCity = runClubCity;
    
    // Extract route neighborhood separately (e.g. "Arlington Heights", "Back Bay")
    // Route neighborhood gives run flavor - separate from city
    let extractedRouteNeighborhood = null;
    const neighborhoodPatterns = [
      /(?:in|at|near|through)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:neighborhood|area|district|heights|village|square|commons)/i,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:neighborhood|area|district|heights|village|square|commons)/i,
      /(?:neighborhood|area|district)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    ];
    for (const pattern of neighborhoodPatterns) {
      const match = combinedInput.match(pattern);
      if (match && match[1]) {
        extractedRouteNeighborhood = match[1].trim();
        break;
      }
    }
    
    // Extract run type: track, trail, neighborhood, park
    // Only these 4 values allowed
    let extractedRunType: 'track' | 'trail' | 'neighborhood' | 'park' | null = null;
    const runTypePatterns = [
      { pattern: /(?:track|track workout|on the track|at the track)/i, value: 'track' as const },
      { pattern: /(?:trail|trail run|trail running|on trails)/i, value: 'trail' as const },
      { pattern: /(?:neighborhood|neighborhood run|through neighborhoods)/i, value: 'neighborhood' as const },
      { pattern: /(?:park|park run|in the park|through the park)/i, value: 'park' as const },
    ];
    
    for (const { pattern, value } of runTypePatterns) {
      const match = combinedInput.match(pattern);
      if (match) {
        extractedRunType = value;
        break;
      }
    }
    
    // Also check runSchedule if runClubId provided (for track inference)
    if (!extractedRunType && runClubId) {
      try {
        const runClub = await prisma.run_clubs.findUnique({
          where: { id: runClubId },
          select: { id: true }, // We'd need runSchedule but it's not in run_clubs model
        });
        // Note: runSchedule is on acq_run_clubs in GoFastCompany, not run_clubs in gofastapp-mvp
        // So we can't check it here - it's handled in the frontend component
      } catch (error) {
        // Ignore - runSchedule check happens in frontend
      }
    }
    
    // Extract workout description/focus (e.g. "emphasizes speed training for those want to increase threshold")
    let extractedWorkoutDescription = null;
    const workoutDescriptionPatterns = [
      /(?:this is|this|a)\s+(?:track\s+)?workout\s+(?:that\s+)?(?:emphasizes|focuses?\s+on|for|designed\s+for)\s+([^.\n]{10,}?)(?:\.|,|\n|$)/i,
      /(?:workout|run|session)\s+(?:that\s+)?(?:emphasizes|focuses?\s+on|for|designed\s+for)\s+([^.\n]{10,}?)(?:\.|,|\n|$)/i,
      /(?:emphasizes|focuses?\s+on|for|designed\s+for)\s+([^.\n]{10,}?)(?:\.|,|\n|$)/i,
      /(?:speed\s+training|threshold|intervals|tempo|endurance|strength)\s+(?:for|to|that)\s+([^.\n]{10,}?)(?:\.|,|\n|$)/i,
    ];
    for (const pattern of workoutDescriptionPatterns) {
      const match = combinedInput.match(pattern);
      if (match && match[1]) {
        extractedWorkoutDescription = match[1].trim();
        // Clean up common trailing words
        extractedWorkoutDescription = extractedWorkoutDescription.replace(/\s+(and|or|before|after|then|to|does|miles).*$/i, '').trim();
        if (extractedWorkoutDescription.length > 10) {
          break;
        }
      }
    }
    
    // Extract pace - look for "all paces welcome", pace ranges, or specific paces
    let extractedPace = null;
    const pacePatterns = [
      /(?:all\s+)?paces?\s+(?:welcome|accepted|invited)/i,
      /pace[:\s]+([0-9]+:[0-9]+(?:\s*-\s*[0-9]+:[0-9]+)?)/i,
      /([0-9]+:[0-9]+(?:\s*-\s*[0-9]+:[0-9]+)?)\s*(?:pace|min\/mile|per mile)/i,
      /(?:pace|speed)[:\s]+([0-9]+(?:\.[0-9]+)?)\s*(?:min|minutes?)/i,
    ];
    
    for (const pattern of pacePatterns) {
      const match = combinedInput.match(pattern);
      if (match) {
        // Check if it's "all paces welcome" pattern
        if (match[0] && /all\s+paces?\s+welcome/i.test(match[0])) {
          extractedPace = 'All Paces Welcome';
        } else if (match[1]) {
          extractedPace = match[1].trim();
        }
        if (extractedPace) break;
      }
    }
    
    // Extract post-run activity information
    // Patterns: "finished with X", "ends with X", "run finishes with X", "post-run X"
    let extractedPostRunActivity = null;
    const finishedPatterns = [
      /(?:run|we|group)\s+(?:finishes?|ends?|concludes?)\s+(?:with|at)\s+([^.\n]{5,}?)(?:\.|,|\n|$)/i,
      /(?:finished|ends?)\s+(?:with|at)\s+([^.\n]{5,}?)(?:\.|,|\n|$)/i,
      /(?:post-run|after|following)\s+([^.\n]{5,}?)(?:\.|,|\n|$)/i,
      /(?:social|coffee|drinks?|food|breakfast|brunch)\s+(?:at|in|near)\s+([A-Z][^.\n]{5,}?)(?:\.|,|\n|$)/i,
    ];
    
    for (const pattern of finishedPatterns) {
      const match = combinedInput.match(pattern);
      if (match && match[1]) {
        extractedPostRunActivity = match[1].trim();
        // Clean up common trailing words
        extractedPostRunActivity = extractedPostRunActivity.replace(/\s+(and|or|before|after|then|to|does|miles).*$/i, '').trim();
        if (extractedPostRunActivity.length > 5) {
          break;
        }
      }
    }
    
    // Extract title (first line or first sentence from any source)
    const lines = combinedInput.split('\n').filter(l => l.trim() && !l.startsWith('['));
    const extractedTitle = lines[0]?.trim() || null;
    
    // Generate structured description from extracted fields
    // Build a well-formatted description incorporating all extracted information
    const descriptionParts: string[] = [];
    
    // Start with route description if we have location info
    if (extractedLocation) {
      let routeDesc = `This run meets at ${extractedLocation}`;
      if (extractedRouteNeighborhood) {
        routeDesc += ` in the ${extractedRouteNeighborhood} neighborhood`;
      } else if (extractedCity) {
        routeDesc += ` in ${extractedCity}`;
      }
      descriptionParts.push(routeDesc);
    }
    
    // Add miles and route type
    if (extractedMiles) {
      let milesDesc = `The route covers ${extractedMiles} miles`;
      if (extractedRunType) {
        milesDesc += ` on ${extractedRunType === 'neighborhood' ? 'neighborhood streets' : `the ${extractedRunType}`}`;
      }
      if (extractedRunType === 'track') {
        milesDesc += ' before returning to the track';
      } else {
        milesDesc += ' before returning to the start';
      }
      descriptionParts.push(milesDesc);
    }
    
    // Add pace information
    if (extractedPace) {
      if (extractedPace === 'All Paces Welcome') {
        descriptionParts.push('All paces are welcome');
      } else {
        descriptionParts.push(`Pace: ${extractedPace} per mile`);
      }
    }
    
    // Add workout description if it's a track workout
    if (extractedRunType === 'track' && extractedWorkoutDescription) {
      descriptionParts.push(`This is a track workout that ${extractedWorkoutDescription}`);
    } else if (extractedWorkoutDescription) {
      descriptionParts.push(`This workout ${extractedWorkoutDescription}`);
    }
    
    // Add post-run activity info
    if (extractedPostRunActivity) {
      descriptionParts.push(`The run finishes with ${extractedPostRunActivity}`);
    }
    
    // Combine structured description, or fall back to raw text if no structured data
    let extractedDescription: string;
    if (descriptionParts.length > 0) {
      extractedDescription = descriptionParts.join('. ') + '.';
    } else {
      // Fallback: use original text but clean it up
      extractedDescription = lines.slice(1).join('\n').trim() || combinedInput.trim();
    }

    return NextResponse.json({
      success: true,
      runData: {
        title: extractedTitle,
        date: extractedDate,
        startTimeHour: extractedHour,
        startTimeMinute: extractedMinute,
        startTimePeriod: extractedPeriod,
        meetUpPoint: extractedLocation,
        meetUpCity: extractedCity,
        routeNeighborhood: extractedRouteNeighborhood,
        runType: extractedRunType,
        workoutDescription: extractedWorkoutDescription,
        totalMiles: extractedMiles,
        pace: extractedPace,
        postRunActivity: extractedPostRunActivity,
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
