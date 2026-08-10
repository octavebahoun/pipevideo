import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Content Factory — Automatisez votre chaîne YouTube',
  description: 'De l\'idée à la publication : générez, montez et publiez des vidéos courtes automatiquement, propulsé par l\'IA.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="antialiased min-h-screen bg-[var(--background)]">
        {children}
      </body>
    </html>
  );
}
