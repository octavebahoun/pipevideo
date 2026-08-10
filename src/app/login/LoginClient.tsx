'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Film, Loader2, LogIn } from 'lucide-react';

export default function LoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        router.push('/dashboard');
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Erreur lors de la connexion.');
      }
    } catch (err) {
      setError('Erreur réseau, réessayez.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      {/* Left: branding panel */}
      <div className="relative hidden md:flex flex-col justify-between p-12 bg-gradient-to-br from-red-900 via-red-700 to-black overflow-hidden">
        <div className="absolute top-1/3 -left-20 w-96 h-96 bg-red-500/30 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-0 right-0 w-72 h-72 bg-black/40 rounded-full blur-3xl" />

        <div className="relative flex items-center gap-2">
          <Film className="w-7 h-7 text-white" />
          <span className="text-xl font-extrabold text-white tracking-tight">Content Factory</span>
        </div>

        <div className="relative">
          <h2 className="text-3xl font-extrabold text-white leading-tight mb-4">
            Votre chaîne YouTube, sur pilote automatique.
          </h2>
          <p className="text-red-100/80 text-sm max-w-sm">
            Génération IA, montage cloud, publication programmée — tout est déjà en place, connectez-vous pour reprendre là où vous en étiez.
          </p>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center p-8 bg-[var(--background)]">
        <div className="w-full max-w-sm">
          <div className="md:hidden flex items-center gap-2 mb-8 justify-center">
            <Film className="w-6 h-6 text-red-500" />
            <span className="text-lg font-extrabold text-zinc-900">Content Factory</span>
          </div>

          <h1 className="text-2xl font-bold text-zinc-900 mb-1">Connexion</h1>
          <p className="text-sm text-zinc-500 mb-8">Accédez à votre dashboard de production.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full bg-white border border-zinc-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 transition-colors shadow-sm"
                placeholder="vous@exemple.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-white border border-zinc-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 transition-colors shadow-sm"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">{error}</p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 btn-glossy-red disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all mt-2"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><LogIn className="w-4 h-4" /> Se connecter</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
