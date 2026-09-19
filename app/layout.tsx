import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import ClientProviders from '@/components/ClientProviders';

export const metadata: Metadata = {
  title: 'GoFast',
  description: 'GoFast Running App',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192.png',
    shortcut: '/icons/icon-192.png',
    apple: '/icons/icon-512.png',
  },
};

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-CQ0GJCJLXX';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}

