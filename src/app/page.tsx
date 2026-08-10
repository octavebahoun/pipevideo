import Link from 'next/link';
import {
  Sparkles,
  Cloud,
  Send,
  BarChart3,
  ArrowRight,
  Film,
  Lightbulb,
  Wand2,
  CalendarClock,
  Loader2,
  CheckCircle2,
  Clock,
  Play,
  Tv,
} from 'lucide-react';

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

const PROCESS_STEPS = [
  {
    number: '01',
    icon: Lightbulb,
    title: "L'idée",
    description:
      'Donnez un titre et un sujet en quelques mots. L\'IA se charge de rédiger le script et de découper le storyboard scène par scène.',
  },
  {
    number: '02',
    icon: Wand2,
    title: 'La fabrication',
    description:
      'Voix off, visuels et sous-titres sont générés puis montés automatiquement — le rendu final est distribué dans le cloud, quelle que soit la durée.',
  },
  {
    number: '03',
    icon: CalendarClock,
    title: 'La diffusion',
    description:
      'Publiez immédiatement ou programmez la mise en ligne à l\'heure de votre choix. Les statistiques remontent ensuite dans un tableau de bord unique.',
  },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute top-0 right-1/4 w-[32rem] h-[32rem] bg-red-600/20 rounded-full blur-3xl animate-pulse-slow -z-10" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse-slow -z-10" />

      {/* NAV */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <Film className="w-6 h-6 text-red-500" />
          <span className="text-lg font-extrabold text-zinc-900 tracking-tight">Content Factory</span>
        </div>
        <div className="flex items-center gap-8">
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-500">
            <a href="#comment-ca-marche" className="hover:text-zinc-900 transition-colors">Comment ça marche</a>
            <a href="#fonctionnalites" className="hover:text-zinc-900 transition-colors">Fonctionnalités</a>
          </div>
          <Link
            href="/login"
            className="px-5 py-2.5 btn-glossy-red text-white rounded-xl font-medium text-sm shrink-0"
          >
            Se connecter
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="px-6 md:px-12 max-w-5xl mx-auto text-center pt-16 md:pt-24 pb-16">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-600 text-xs font-bold uppercase tracking-widest mb-8">
          <Sparkles className="w-3.5 h-3.5" /> Pipeline vidéo automatisé
        </span>
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

      {/* PRODUCT PREVIEW MOCKUP */}
      <section className="px-6 md:px-12 max-w-4xl mx-auto pb-24 md:pb-32">
        <div className="glass rounded-3xl p-3 md:p-4 shadow-2xl">
          <div className="flex items-center gap-1.5 px-3 py-2">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-300" />
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-300" />
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-300" />
          </div>
          <div className="bg-[var(--background)] rounded-2xl p-4 md:p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="btn-glossy-white p-4 rounded-xl">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-600 border border-blue-200 inline-flex items-center gap-1.5 mb-3">
                <Sparkles className="w-3 h-3" /> Scénarisé
              </span>
              <p className="text-sm font-bold text-zinc-900 truncate">Le mystère de l'anaconda</p>
              <p className="text-xs text-zinc-400 mt-1">Sujet : Amazonie, faune géante</p>
            </div>
            <div className="btn-glossy-white p-4 rounded-xl">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-200 inline-flex items-center gap-1.5 mb-3">
                <Loader2 className="w-3 h-3 animate-spin" /> Rendu en cours
              </span>
              <p className="text-sm font-bold text-zinc-900 truncate">Le réacteur oublié</p>
              <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200 mt-3">
                <div className="h-full w-2/3 bg-gradient-to-r from-red-600 to-red-500 rounded-full" />
              </div>
            </div>
            <div className="btn-glossy-white p-4 rounded-xl">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-50 text-red-600 border border-red-200 inline-flex items-center gap-1.5 mb-3">
                <Tv className="w-3 h-3" /> Publié
              </span>
              <p className="text-sm font-bold text-zinc-900 truncate">La vérité sur Pompéi</p>
              <div className="flex items-center gap-3 text-xs text-zinc-400 mt-3">
                <span className="flex items-center gap-1"><Play className="w-3 h-3" /> 48K</span>
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Auto</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* EDITORIAL STATEMENT */}
      <section className="px-6 md:px-12 max-w-4xl mx-auto pb-24 md:pb-32">
        <p className="text-xs font-bold uppercase tracking-widest text-red-500 mb-4">Le constat</p>
        <p className="text-2xl md:text-4xl font-bold text-zinc-900 leading-snug">
          Écrire, doubler, monter, sous-titrer, publier, suivre les stats
          <span className="text-zinc-300"> — produire un short demande une dizaine d'outils et des heures de travail. </span>
          Content Factory fait tenir tout ce pipeline dans un seul écran.
        </p>
      </section>

      {/* PROCESS */}
      <section id="comment-ca-marche" className="px-6 md:px-12 max-w-4xl mx-auto pb-24 md:pb-32">
        <header className="mb-16">
          <p className="text-xs font-bold uppercase tracking-widest text-red-500 mb-3">Comment ça marche</p>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-zinc-900">Trois étapes, zéro montage manuel.</h2>
        </header>

        <ol>
          {PROCESS_STEPS.map((step, i) => (
            <li key={step.number} className="relative pl-20 md:pl-28 pb-16 last:pb-0">
              {i < PROCESS_STEPS.length - 1 && (
                <span className="absolute left-[27px] md:left-[35px] top-14 bottom-0 w-px bg-gradient-to-b from-red-200 to-transparent" />
              )}
              <span className="absolute left-0 top-0 w-14 h-14 md:w-[70px] md:h-[70px] rounded-2xl btn-glossy-white flex items-center justify-center">
                <step.icon className="w-6 h-6 md:w-7 md:h-7 text-red-500" />
              </span>
              <span className="block text-xs font-bold text-red-300 tracking-widest mb-2">{step.number}</span>
              <h3 className="text-xl font-bold text-zinc-900 mb-2">{step.title}</h3>
              <p className="text-zinc-500 leading-relaxed max-w-xl">{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* FEATURES */}
      <section id="fonctionnalites" className="px-6 md:px-12 max-w-6xl mx-auto pb-24 md:pb-32">
        <header className="mb-12 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-widest text-red-500 mb-3">Fonctionnalités</p>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-zinc-900">Tout ce qu'il faut pour tenir une chaîne au quotidien.</h2>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((feature, i) => (
            <div
              key={feature.title}
              className="btn-glossy-white p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex items-center justify-between mb-4">
                <feature.icon className="w-8 h-8 text-red-500" />
                <span className="text-xs font-bold text-zinc-300">0{i + 1}</span>
              </div>
              <h3 className="text-zinc-900 font-bold mb-2">{feature.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURE DEEP-DIVE */}
      <section className="px-6 md:px-12 max-w-6xl mx-auto pb-24 md:pb-32">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-red-500 mb-3">Zoom sur le rendu cloud</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 mb-5">
              Pas de machine à faire tourner, pas de rendu à surveiller.
            </h2>
            <p className="text-zinc-500 leading-relaxed mb-6">
              Chaque vidéo est montée avec Remotion et rendue à la demande — localement pour itérer vite, ou distribuée
              sur AWS Lambda pour les formats plus longs. Le fichier final atterrit directement sur un stockage durable,
              prêt à être publié.
            </p>
            <ul className="space-y-3">
              {[
                'Reprise intelligente : les scènes déjà générées ne sont jamais refaites pour rien.',
                'Suivi de progression en temps réel, scène par scène.',
                'Upload automatique vers le stockage cloud une fois le rendu terminé.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-zinc-600">
                  <CheckCircle2 className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="glass rounded-2xl p-6">
            <div className="flex justify-between items-center text-xs mb-2">
              <span className="text-zinc-500 font-medium">Rendu de « Le réacteur oublié »</span>
              <span className="text-red-600 font-bold">68%</span>
            </div>
            <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200 mb-6">
              <div className="h-full w-[68%] bg-gradient-to-r from-red-600 to-red-500 rounded-full shadow-[0_0_8px_rgba(255,0,0,0.3)]" />
            </div>
            <div className="space-y-2.5 text-sm">
              {[
                { label: 'Voix off générée', done: true },
                { label: 'Visuels des 8 scènes', done: true },
                { label: 'Sous-titres synchronisés', done: true },
                { label: 'Montage final Remotion', done: false },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-2.5 text-zinc-600">
                  {row.done ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                  {row.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="relative bg-gradient-to-br from-red-900 via-red-700 to-black overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500/30 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-0 right-0 w-72 h-72 bg-black/40 rounded-full blur-3xl" />
        <div className="relative px-6 md:px-12 max-w-3xl mx-auto text-center py-24 md:py-32">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight mb-6">
            Votre prochaine vidéo commence par une idée d'une ligne.
          </h2>
          <p className="text-red-100/80 text-lg mb-10 max-w-xl mx-auto">
            Le reste — script, voix, montage, publication — tourne tout seul pendant que vous passez à la suivante.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-red-700 rounded-xl font-semibold text-base hover:-translate-y-0.5 transition-transform shadow-2xl"
          >
            Accéder au dashboard <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="px-6 md:px-12 py-12 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-8">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-red-500" />
            <span className="text-base font-extrabold text-zinc-900 tracking-tight">Content Factory</span>
          </div>
          <div className="flex items-center gap-8 text-sm font-medium text-zinc-500">
            <a href="#comment-ca-marche" className="hover:text-zinc-900 transition-colors">Comment ça marche</a>
            <a href="#fonctionnalites" className="hover:text-zinc-900 transition-colors">Fonctionnalités</a>
            <Link href="/login" className="hover:text-zinc-900 transition-colors">Connexion</Link>
          </div>
        </div>
        <div className="pt-8 border-t border-zinc-200 text-xs text-zinc-400 text-center md:text-left">
          Content Factory — Pipeline de production vidéo automatisé.
        </div>
      </footer>
    </div>
  );
}
