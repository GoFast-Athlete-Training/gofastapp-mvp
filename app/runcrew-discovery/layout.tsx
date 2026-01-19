// SERVER FILE — Route configuration for /runcrew-discovery
// This route must be dynamic at the server level (auth-gated discovery, no caching)
// The page itself is a client component, but route config lives here

export const dynamic = 'force-dynamic';

export default function RunCrewDiscoveryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

