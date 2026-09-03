import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Google Play Monitor Dashboard',
  description: 'Monitor and analyze Google Play apps and reviews',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
