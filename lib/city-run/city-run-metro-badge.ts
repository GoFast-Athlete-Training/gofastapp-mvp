/** Short badge for hosted / city runs — e.g. "DC Run" from neighborhood or city slug. */
export function formatCityRunMetroBadge(input: {
  routeNeighborhood?: string | null;
  citySlug?: string | null;
  meetUpCity?: string | null;
  meetUpState?: string | null;
}): string | null {
  const hood = input.routeNeighborhood?.trim();
  if (hood) {
    if (/(\srun)$/i.test(hood)) return hood;
    return `${hood} Run`;
  }

  const state = input.meetUpState?.trim();
  if (state === 'DC' || state === 'District of Columbia') {
    return 'DC Run';
  }

  const slug = input.citySlug?.trim();
  if (slug) {
    const short = slug.length <= 16 ? slug : slug.split('-')[0];
    const label = short
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
    if (label) return `${label} Run`;
  }

  const city = input.meetUpCity?.trim();
  if (city) {
    if (city.toLowerCase() === 'dc' || city.toLowerCase() === 'washington') return 'DC Run';
    return `${city} Run`;
  }

  return null;
}
