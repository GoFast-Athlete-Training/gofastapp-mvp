import type { TemplateFacts } from '@/lib/app-notifications/types';

/** Replace {{key}} placeholders with stringified fact values. */
export function interpolateTemplateString(template: string, facts: TemplateFacts): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = facts[key];
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
  });
}
