export const CONTAINER_TOPICS = [
  'updates',
  'tips',
  'nutrition',
  'routes',
  'chatter',
] as const;

export type ContainerTopic = (typeof CONTAINER_TOPICS)[number];

export const HOST_ONLY_TOPICS: ContainerTopic[] = [
  'updates',
  'tips',
  'nutrition',
  'routes',
];

export const DEFAULT_CONTAINER_TOPIC: ContainerTopic = 'chatter';

export function isValidContainerTopic(value: string): value is ContainerTopic {
  return (CONTAINER_TOPICS as readonly string[]).includes(value);
}

export function containerTopicLabel(topic: ContainerTopic): string {
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
