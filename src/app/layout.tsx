import type { Metadata } from 'next';

/**
 * Layout minimal, conservé uniquement parce que Next.js l'exige à la racine.
 * Cette instance ne sert que des routes API — il n'y a aucune page à afficher.
 */

export const metadata: Metadata = {
  title: 'Pipevideo — API',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
