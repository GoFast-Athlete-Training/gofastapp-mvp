import type { AthleteTipSeries } from './athlete-tips';
import { normalizeTipInput } from './athlete-tips';

const MAX_TITLE = 120;
const MAX_BODY = 8000;
const MAX_TAKEAWAY = 2000;
export const MAX_ABOUT = 8000;

export type DraftAthleteTipResult = {
  title: string;
  body: string;
  takeaway: string | null;
  tipSeries: AthleteTipSeries | null;
};

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Normalize model JSON into the structured tip draft shape. */
export function normalizeDraftAthleteTip(parsed: unknown): DraftAthleteTipResult | null {
  try {
    const input = normalizeTipInput(parsed);
    const title = truncate(input.title, MAX_TITLE);
    const body = truncate(input.body, MAX_BODY);
    if (!title || !body) return null;

    const takeawayRaw = input.takeaway?.trim() || null;
    const takeaway = takeawayRaw ? truncate(takeawayRaw, MAX_TAKEAWAY) : null;

    let tipSeries: AthleteTipSeries | null = null;
    if (input.tipSeries) {
      const tips = input.tipSeries.tips
        .map((item) => ({
          title: truncate(item.title, MAX_TITLE),
          body: truncate(item.body, MAX_BODY),
        }))
        .filter((item) => item.title || item.body);

      const seriesTitle = input.tipSeries.title?.trim() || null;
      if (tips.length > 0 || seriesTitle) {
        tipSeries = { title: seriesTitle, tips };
      }
    }

    return { title, body, takeaway, tipSeries };
  } catch {
    return null;
  }
}

function looksStructuredTipInput(seed: string): boolean {
  const hasSectionLabel =
    /\b(the big idea|big idea|the takeaway|takeaway|tip series)\b/i.test(seed) ||
    /(^|\n)\s*title\s*(\n|$)/i.test(seed);
  const hasNumberedItems = /(^|\n)\s*\d+[.)]\s+\S+/m.test(seed);
  return hasSectionLabel || (hasNumberedItems && seed.length > 200);
}

function buildSystemPrompt(structured: boolean): string {
  const jsonShape = `{
  "title": "...",
  "body": "...",
  "takeaway": "..." or null,
  "tipSeries": {
    "title": "...",
    "tips": [{ "title": "...", "body": "..." }]
  } or null
}`;

  if (structured) {
    return `You structure evergreen training tips for a runner's public GoFast page.

The user pasted structured tip content. Your job is to PARSE it into fields — do not rewrite or summarize unless a field is missing.

Output rules:
- Return ONLY valid JSON matching this shape:
${jsonShape}
- title: from "Title" section, or infer a scannable title if missing (max 120 chars)
- body: from "The Big Idea" section only — not the takeaway or series items (max 8000 chars)
- takeaway: from "The Takeaway" section, or null if absent (max 2000 chars)
- tipSeries.title: from "Tip Series" heading or the line immediately after it
- tipSeries.tips: each numbered/bulleted item becomes { title, body }
  - Use the item heading as title and the following paragraph(s) as body
  - Preserve the author's wording; light punctuation fixes only
- If there is no series section, set tipSeries to null
- Do NOT invent races, finish times, or medical claims
- Tone: direct, warm, coach-athlete voice`;
  }

  return `You draft evergreen training tips for a runner's public GoFast page.

The user gave a rough idea. Expand it into a complete tip.

Output rules:
- Return ONLY valid JSON matching this shape:
${jsonShape}
- title: max 120 chars, specific and scannable
- body: 2–5 short paragraphs, first person, practical and durable (not a daily log)
- takeaway: one memorable line, or null if it would feel forced
- tipSeries: include only when the idea naturally breaks into 2–5 list items; otherwise null
- Do NOT invent races, finish times, or medical claims
- Do NOT write like an announcement or "update" — this is a tip followers revisit
- Tone: direct, warm, coach-athlete voice`;
}

export async function draftAthleteTipFromAbout(about: string): Promise<DraftAthleteTipResult | null> {
  const seed = about.trim();
  if (!seed) return null;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const structured = looksStructuredTipInput(seed);
  const systemPrompt = buildSystemPrompt(structured);
  const userPrompt = structured
    ? `Structure this tip content:\n\n${seed}`
    : `I'm thinking of a tip about: ${seed}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: structured ? 0.2 : 0.7,
        max_tokens: structured ? 2500 : 1200,
      }),
    });

    if (!res.ok) {
      console.error('draftAthleteTip OpenAI HTTP', res.status, await res.text());
      return null;
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    const parsed = parseJsonObject(content);
    if (!parsed) return null;

    return normalizeDraftAthleteTip(parsed);
  } catch (err) {
    console.error('draftAthleteTip:', err);
    return null;
  }
}
