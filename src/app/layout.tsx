import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Content Factory Dashboard',
  description: 'Orchestrateur automatisé de création et publication de vidéos courtes.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="dark">
      <body className="antialiased min-h-screen bg-[#09090b]">
        {children}
      </body>
    </html>
  );
}
