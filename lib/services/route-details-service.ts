import {
  completeJsonObjectAtTemperature,
  getOpenAIClient,
} from "./race-parse/openai-json";

export type RouteDetailsInput = {
  mapImageUrl?: string | null;
  directionsText?: string | null;
  /** Existing route path to refine — not sufficient alone without map or directions. */
  routeNotes?: string | null;
  /** Route/area context (e.g. Ballston) — context only, never sufficient alone. */
  routeNeighborhood?: string | null;
  stravaMapUrl?: string | null;
  /** Instance distance — may open with "roughly X-mile loop" when grounded. */
  totalMiles?: string | number | null;
  /** Meet-up landmark — may reference as departure/finish when grounded. */
  meetUpPoint?: string | null;
};

export type RouteDetailsSuccess = {
  success: true;
  routeNotes: string;
};

export type RouteDetailsFailure = {
  success: false;
  error: string;
};

export type RouteDetailsResult = RouteDetailsSuccess | RouteDetailsFailure;

type RouteSourceMode =
  | "combined"
  | "directions_primary"
  | "map_primary"
  | "refine_existing";

const GOLD_STANDARD_EXAMPLE = `This roughly 3-mile loop showcases some of Ballston's best running terrain, weaving through urban streets, neighborhood green space, and multi-use trails. After departing from the heart of Ballston, runners pass through Quincy Park, winding around its tree-lined pathways and recreation areas before reconnecting with city streets. The route then joins the Custis Trail via the Ballston Connector, offering a quieter stretch of paved trail surrounded by greenery. A final segment along Fairfax Drive returns runners to Ballston for a finish near Compass Coffee.`;

function str(v: unknown): string {
  return v != null ? String(v).trim() : "";
}

function resolveMapImageUrl(input: RouteDetailsInput): string | null {
  const url = str(input.mapImageUrl);
  return url && /^https?:\/\//i.test(url) ? url : null;
}

function hasSubstantialDirections(input: RouteDetailsInput): boolean {
  return str(input.directionsText).length >= 24;
}

function resolveSourceMode(input: RouteDetailsInput): RouteSourceMode {
  const hasMap = !!resolveMapImageUrl(input);
  const hasDirections = hasSubstantialDirections(input);
  const hasExisting = str(input.routeNotes).length > 0;

  if (hasMap && hasDirections) return "combined";
  if (hasDirections) return "directions_primary";
  if (hasMap) return "map_primary";
  if (hasExisting) return "refine_existing";
  return "map_primary";
}

function temperatureForMode(mode: RouteSourceMode): number {
  // Slightly warmer when staff pasted real directions — still grounded, but readable prose.
  if (mode === "directions_primary" || mode === "combined") return 0.25;
  return 0;
}

/**
 * Route AI requires a map image, pasted directions, or an existing route path to refine.
 * routeNeighborhood alone is not enough — it is context only.
 */
export function hasRouteDetailsSource(input: RouteDetailsInput): boolean {
  const evidence = [input.mapImageUrl, input.directionsText, input.routeNotes];
  return evidence.some((v) => str(v) !== "");
}

function buildContextBlock(input: RouteDetailsInput, mode: RouteSourceMode): string {
  const mapImageUrl = resolveMapImageUrl(input);
  const parts: string[] = [];

  if (mode === "combined") {
    parts.push(
      "SOURCES (use together):",
      "1. PRIMARY for place names, landmarks, and segment order: pasted directions below.",
      "2. PRIMARY for geometry: trace the colored/orange route polyline on the map image.",
      "Reconcile both — directions win for names; map wins for what the line actually follows vs crosses."
    );
  } else if (mode === "directions_primary") {
    parts.push(
      "PRIMARY SOURCE: Pasted directions below. Turn them into polished runner-facing prose.",
      "Use the map image only if one is attached; otherwise do not invent streets beyond the directions."
    );
  } else if (mode === "map_primary") {
    parts.push(
      "PRIMARY SOURCE: Route map image attached.",
      "Trace ONLY the colored/orange route polyline — not nearby parallel roads."
    );
  } else {
    parts.push(
      "PRIMARY SOURCE: Existing route path to refine.",
      "Tighten wording only — do not add new streets or landmarks unless also visible on an attached map or in pasted directions."
    );
  }

  if (mapImageUrl) {
    parts.push("", "Route map image: attached (vision).");
  }

  const directions = str(input.directionsText);
  if (directions) {
    parts.push("", `Pasted directions:\n${directions}`);
  }

  const existing = str(input.routeNotes);
  if (existing && mode !== "directions_primary") {
    parts.push("", `Existing route path to refine:\n${existing}`);
  }

  const neighborhood = str(input.routeNeighborhood);
  if (neighborhood) {
    parts.push("", `Route area / neighborhood (context only): ${neighborhood}`);
  }

  const meetUp = str(input.meetUpPoint);
  if (meetUp) {
    parts.push("", `Meet-up point: ${meetUp}`);
  }

  const miles = str(input.totalMiles);
  if (miles) {
    parts.push("", `Distance: ${miles} miles`);
  }

  const stravaMap = str(input.stravaMapUrl);
  if (stravaMap) parts.push("", `Strava route URL: ${stravaMap}`);

  return parts.join("\n");
}

function buildStyleBlock(mode: RouteSourceMode): string {
  if (mode === "map_primary" || mode === "refine_existing") {
    return `=== OUTPUT STYLE ===
- 1-2 short sentences tracing the colored route line in order.
- Name streets/trails/parks ONLY if clearly labeled on the map or in pasted directions.
- Conservative is better than creative when the map is ambiguous.`;
  }

  return `=== OUTPUT STYLE ===
Write 2-4 sentences of runner-facing prose in chronological order (start → middle segments → finish).

Target voice (illustrative — use ONLY names and features from your sources, not this example's places unless they appear in your inputs):
"${GOLD_STANDARD_EXAMPLE}"

Good patterns to follow when your sources support them:
- Open with distance + neighborhood/terrain if distance or area is known ("roughly 3-mile loop", "urban streets and multi-use trails").
- Name specific parks, trails, connectors, and streets from the directions or map labels.
- Brief sensory detail tied to real features ("tree-lined pathways", "quieter paved trail", "returns to … for a finish near …").
- Use "runners pass through", "joins", "winds around", "returns along" — not turn-by-turn GPS dumps.`;
}

function buildGroundingRules(mode: RouteSourceMode): string {
  const shared = [
    "- Do NOT mention pace, welcome language, club overview, schedule, or post-run social.",
    '- Do NOT use vague filler: "main roads", "several turns", "winds through the area", "local trails and parks" unless each ties to a named feature from your sources.',
  ];

  if (mode === "map_primary") {
    return `=== GROUNDING RULES (strict — map only) ===
${shared.join("\n")}
- Trace ONLY where the colored/orange route polyline goes. Ignore roads merely labeled nearby.
- Say a street is "followed" or "along" ONLY if the route line runs on it for a visible segment. If the line only intersects a labeled street, say "crosses" — never "follows".
- Use compass directions only when the line direction is clear on the map.
- If the map is ambiguous, write ONE short conservative sentence naming only what you can clearly see on the line. Omit uncertain street names.`;
  }

  if (mode === "refine_existing") {
    return `=== GROUNDING RULES ===
${shared.join("\n")}
- Keep all place names from the existing path unless correcting against an attached map or pasted directions.
- Do not add new landmarks not present in any source.`;
  }

  return `=== GROUNDING RULES ===
${shared.join("\n")}
- Every street, trail, park, and landmark in the output MUST appear in pasted directions, map labels, meet-up point, or route area context. Never invent a path segment.
- When map + directions disagree, prefer directions for names and map for whether the line follows vs crosses a road.
- Distance in the opening ("roughly X-mile") only if distance was provided or clearly stated in pasted directions.
- Meet-up / finish references only when meet-up point or directions mention them.`;
}

function buildRouteDetailsPrompt(input: RouteDetailsInput): string {
  const mode = resolveSourceMode(input);
  const context = buildContextBlock(input, mode);
  const style = buildStyleBlock(mode);
  const rules = buildGroundingRules(mode);

  return `You write a public route path blurb for a group run page.

${context}

=== TASK ===
Return ONLY JSON:
{
  "routeNotes": "Runner-facing route path description."
}

${style}

${rules}`;
}

export async function generateRouteDetails(
  input: RouteDetailsInput
): Promise<RouteDetailsResult> {
  if (!hasRouteDetailsSource(input)) {
    return {
      success: false,
      error: "Upload a route map or add pasted directions first.",
    };
  }

  try {
    getOpenAIClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "OpenAI is not configured";
    return { success: false, error: msg };
  }

  const mapImageUrl = resolveMapImageUrl(input);
  const mode = resolveSourceMode(input);
  const prompt = buildRouteDetailsPrompt(input);

  try {
    const parsed = await completeJsonObjectAtTemperature(
      prompt,
      temperatureForMode(mode),
      mapImageUrl ? { url: mapImageUrl } : null
    );
    const routeNotes =
      typeof parsed.routeNotes === "string" ? parsed.routeNotes.trim() : "";
    if (!routeNotes) {
      return { success: false, error: "Model response missing routeNotes." };
    }
    return { success: true, routeNotes };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to generate route details";
    return { success: false, error: msg };
  }
}
