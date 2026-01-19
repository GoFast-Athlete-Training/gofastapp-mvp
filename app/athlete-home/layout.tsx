// SERVER FILE — Route configuration for /athlete-home
// This route must be dynamic at the server level (auth-gated, personalized content)
// The page itself is a client component, but route config lives here

export const dynamic = 'force-dynamic';

export default function AthleteHomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

