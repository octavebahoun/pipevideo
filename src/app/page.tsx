import Link from 'next/link';
import { Sparkles, Cloud, Send, BarChart3, ArrowRight, Film } from 'lucide-react';

const FEATURES = [
  {
    icon: Sparkles,
    title: 'Génération par IA',
    description: 'Voix off réaliste, images et vidéos générées automatiquement à partir d\'un simple script.',
  },
  {
    icon: Cloud,
    title: 'Rendu dans le cloud',
    description: 'Montage vidéo distribué sur AWS Lambda — vos vidéos sont prêtes en quelques minutes, peu importe leur durée.',
  },
  {
    icon: Send,
    title: 'Publication automatique',
    description: 'Une fois rendues, vos vidéos sont publiées directement sur YouTube, à l\'heure de votre choix.',
  },
  {
    icon: BarChart3,
    title: 'Statistiques centralisées',
    description: 'Suivez vues, likes et commentaires de toutes vos vidéos publiées, exportables en un clic.',
  },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute top-0 right-1/4 w-[32rem] h-[32rem] bg-red-600/20 rounded-full blur-3xl animate-pulse-slow -z-10" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse-slow -z-10" />

      <nav className="flex items-center justify-between px-6 md:px-12 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <Film className="w-6 h-6 text-red-500" />
          <span className="text-lg font-extrabold text-zinc-900 tracking-tight">Content Factory</span>
        </div>
        <Link
          href="/login"
          className="px-5 py-2.5 btn-glossy-red text-white rounded-xl font-medium text-sm"
        >
          Se connecter
        </Link>
      </nav>

      <section className="px-6 md:px-12 max-w-5xl mx-auto text-center pt-16 md:pt-24 pb-20">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-zinc-900 text-glow leading-tight">
          Automatisez votre chaîne YouTube,<br />de l'idée à la publication.
        </h1>
        <p className="text-lg text-zinc-500 mt-6 max-w-2xl mx-auto">
          Content Factory génère, monte et publie vos vidéos courtes automatiquement — propulsé par l'IA, sans intervention manuelle.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 mt-10 px-8 py-4 btn-glossy-red text-white rounded-xl font-semibold text-base hover:-translate-y-0.5"
        >
          Accéder au dashboard <ArrowRight className="w-5 h-5" />
        </Link>
      </section>

      <section className="px-6 md:px-12 max-w-6xl mx-auto pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="btn-glossy-white p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1"
            >
              <feature.icon className="w-8 h-8 text-red-500 mb-4" />
              <h3 className="text-zinc-900 font-bold mb-2">{feature.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="px-6 md:px-12 py-8 text-center text-xs text-zinc-400 border-t border-zinc-200">
        Content Factory — Pipeline de production vidéo automatisé.
      </footer>
    </div>
  );
}
