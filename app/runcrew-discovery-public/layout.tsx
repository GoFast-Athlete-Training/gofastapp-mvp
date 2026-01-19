// SERVER FILE — Route configuration for /runcrew-discovery-public
// This route must be dynamic at the server level (public discovery, no caching)
// The page itself is a client component, but route config lives here

export const dynamic = 'force-dynamic';

export default function RunCrewDiscoveryPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

