export interface ClusteredRuleSet {
  topics: Array<{
    topic: string;
    rules: string[];
  }>;
}

/**
 * Cluster rule text into topic groups using OpenAI (fetch, no openai package).
 */
export async function clusterRuleSet(rawBlob: string): Promise<ClusteredRuleSet> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  const systemMessage = `You are a TrainingBuild RuleSet Helper.
Your job is to take unstructured human-written rules and infer grouped topic areas relevant to a running training app.

Scan for themes like:
- phase rules (base, build, peak, taper)
- weekly pattern rules
- quality workout rules
- long run rules
- pacing rules
- mileage progression rules
- recovery rules
- safety constraints
- workout distribution

Return JSON ONLY in the following shape:

{
  "topics": [
    {
      "topic": "topic_name_in_snake_case",
      "rules": [
        "rule text 1",
        "rule text 2",
        ...
      ]
    }
  ]
}

You MUST return valid JSON. No comments. No markdown. No additional text.`;

  const userMessage = `Convert the following text into clustered rule topics:

${rawBlob}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI cluster failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  let cleaned = content.replace(/```json|```/g, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  const parsed = JSON.parse(cleaned) as ClusteredRuleSet;

  if (!parsed.topics || !Array.isArray(parsed.topics)) {
    throw new Error("Invalid response format: missing topics array");
  }

  return parsed;
}
