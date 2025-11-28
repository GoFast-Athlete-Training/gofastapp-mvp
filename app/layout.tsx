import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GoFast',
  description: 'GoFast Running App',
  icons: {
    icon: '/logo.jpg',
    shortcut: '/logo.jpg',
    apple: '/logo.jpg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

