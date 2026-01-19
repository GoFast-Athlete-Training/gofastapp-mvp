// SERVER FILE — Route configuration for /runcrew/create
// This route must be dynamic at the server level (no static optimization)
// The page itself is a client component, but route config lives here

export const dynamic = 'force-dynamic';

export default function RunCrewCreateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

