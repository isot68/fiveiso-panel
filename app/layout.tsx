import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FiveISO | FiveM Kontrol Merkezi',
  icons: { icon: { url: '/assets/logomain.webp', type: 'image/webp' } },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className="dark">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

