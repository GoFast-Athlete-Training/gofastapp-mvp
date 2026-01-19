// SERVER FILE — Route configuration for /settings
// This route must be dynamic at the server level (auth-gated, personalized settings)
// The page itself is a client component, but route config lives here

export const dynamic = 'force-dynamic';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

