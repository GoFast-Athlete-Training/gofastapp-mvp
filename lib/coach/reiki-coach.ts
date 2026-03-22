/**
 * Single-turn OpenAI call for "Reiki" coach assistant.
 */

const REIKI_SYSTEM_BASE = `You are Reiki, an AI-powered running coach assistant for GoFast.
You help athletes with training plans, injury questions, pacing, and race preparation.
Be concise, encouraging, and practical. You are not a doctor — for serious injury or pain, recommend seeing a qualified professional.
Do not make up medical diagnoses.`;

export type ReikiCoachContext = {
  fiveKPace?: string | null;
  goalSummary?: string | null;
};

function buildSystemPrompt(ctx: ReikiCoachContext): string {
  const parts = [REIKI_SYSTEM_BASE];
  if (ctx.fiveKPace?.trim()) {
    parts.push(`The athlete's current 5K pace (self-reported) is approximately: ${ctx.fiveKPace.trim()}.`);
  }
  if (ctx.goalSummary?.trim()) {
    parts.push(`Their active race goal context: ${ctx.goalSummary.trim()}.`);
  }
  return parts.join("\n\n");
}

export async function askReikiCoach(params: {
  userMessage: string;
  context: ReikiCoachContext;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const message = params.userMessage.trim();
  if (!message) {
    throw new Error("Message is required");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: buildSystemPrompt(params.context) },
        { role: "user", content: message },
      ],
      temperature: 0.6,
      max_tokens: 900,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI coach failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("Empty OpenAI response");
  }

  return content;
}
