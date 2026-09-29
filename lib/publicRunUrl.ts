/** Public run page on gofast-contentpublic (city subdomain). */
export function getPublicRunContentUrl(options: {
  runId: string;
  slug?: string | null;
  citySlug?: string | null;
}): string {
  const baseDomain =
    process.env.NEXT_PUBLIC_CONTENT_PUBLIC_BASE_DOMAIN || "gofastcrushgoals.com";
  const city = (options.citySlug || "dc").toLowerCase();
  const citySubdomain =
    city === "dc" || city === "arlington" || city === "washington-dc" ? "dcruns" : "dcruns";
  const segment =
    options.slug && options.slug.trim() ? options.slug.trim() : options.runId;
  return `https://${citySubdomain}.${baseDomain}/runs/${encodeURIComponent(segment)}`;
}
