/** Default chatter channels for race hub (stored as race_messages.topic). */
export const RACE_HUB_DEFAULT_TOPICS = [
  "general",
  "my-goal-time",
  "questions",
] as const;

export type RaceHubTopic = (typeof RACE_HUB_DEFAULT_TOPICS)[number];

const TOPIC_LABELS: Record<RaceHubTopic, string> = {
  general: "General",
  "my-goal-time": "My Goal Time",
  questions: "Questions",
};

export function labelForRaceHubTopic(topic: string): string {
  if (topic in TOPIC_LABELS) {
    return TOPIC_LABELS[topic as RaceHubTopic];
  }
  return topic;
}

export function normalizeRaceHubTopic(raw: string | undefined | null): RaceHubTopic {
  const t = raw?.trim();
  if (t === "my-goal-time" || t === "questions") return t;
  return "general";
}
