const MAX_TITLE = 120;
const MAX_BODY = 8000;

export type DraftAthleteTipResult = {
  title: string;
  body: string;
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

export async function draftAthleteTipFromAbout(about: string): Promise<DraftAthleteTipResult | null> {
  const seed = about.trim();
  if (!seed) return null;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const systemPrompt = `You draft evergreen training tips for a runner's public GoFast page.

Output rules:
- Return ONLY valid JSON: {"title":"...","body":"..."}
- title: max 120 chars, specific and scannable
- body: 2–5 short paragraphs, first person, practical and durable (not a daily log)
- Do NOT invent races, finish times, or medical claims
- Do NOT write like an announcement or "update" — this is a tip followers revisit
- Tone: direct, warm, coach-athlete voice`;

  const userPrompt = `I'm thinking of a tip about: ${seed}`;

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
        temperature: 0.7,
        max_tokens: 900,
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
    const title = truncate(String(parsed?.title ?? ''), MAX_TITLE);
    const body = truncate(String(parsed?.body ?? ''), MAX_BODY);
    if (!title || !body) return null;

    return { title, body };
  } catch (err) {
    console.error('draftAthleteTip:', err);
    return null;
  }
}
