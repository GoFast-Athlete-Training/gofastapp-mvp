export const CONTAINER_TOPICS = [
  'tips',
  'nutrition',
  'routes',
  'chatter',
] as const;

export type ContainerTopic = (typeof CONTAINER_TOPICS)[number];

/** @deprecated Journey broadcasts use gofast_athlete_announcements — not a message topic. */
export type LegacyContainerTopic = ContainerTopic | 'updates';

export const HOST_ONLY_TOPICS: ContainerTopic[] = ['tips', 'nutrition', 'routes'];

export const DEFAULT_CONTAINER_TOPIC: ContainerTopic = 'chatter';

export function isValidContainerTopic(value: string): value is ContainerTopic {
  return (CONTAINER_TOPICS as readonly string[]).includes(value);
}

export function containerTopicLabel(topic: LegacyContainerTopic): string {
  switch (topic) {
    case 'updates':
      return 'Updates';
    case 'tips':
      return 'Tips';
    case 'nutrition':
      return 'Nutrition';
    case 'routes':
      return 'Routes';
    case 'chatter':
      return 'Chatter';
    default:
      return topic;
  }
}

export function canMemberPostToTopic(topic: ContainerTopic): boolean {
  return topic === 'chatter';
}

export function canHostPostToTopic(_topic: ContainerTopic): boolean {
  return true;
}
