// SERVER FILE — Route configuration for /profile
// This route must be dynamic at the server level (auth-gated, personalized profile)
// The page itself is a client component, but route config lives here

export const dynamic = 'force-dynamic';

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

