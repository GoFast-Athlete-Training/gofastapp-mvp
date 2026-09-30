export function formatDayLabel(dayOfWeek: string): string {
  const lower = dayOfWeek.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
