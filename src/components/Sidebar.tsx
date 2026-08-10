'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Tv, Clock, CalendarClock, BarChart3, LogOut, Film, Menu, X } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Vidéos publiées', icon: Tv },
  { href: '/dashboard/unpublished', label: 'Non publiées', icon: Clock },
  { href: '/dashboard/scheduled', label: 'Programmées', icon: CalendarClock },
  { href: '/dashboard/stats', label: 'Statistiques', icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Close the mobile drawer automatically whenever the route changes.
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const navContent = (
    <>
      <div className="flex items-center gap-2 mb-10 px-2">
        <Film className="w-6 h-6 text-red-500" />
        <span className="text-lg font-extrabold text-zinc-900 tracking-tight">Content Factory</span>
      </div>

      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-red-50 text-red-600 border border-red-200'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Déconnexion
      </button>
    </>
  );

  return (
    <>
      {/* Mobile top bar: hamburger trigger, only below md */}
      <div className="md:hidden sticky top-0 z-40 flex items-center justify-between glass border-b border-zinc-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <Film className="w-5 h-5 text-red-500" />
          <span className="text-base font-extrabold text-zinc-900 tracking-tight">Content Factory</span>
        </div>
        <button
          onClick={() => setIsMobileOpen(true)}
          className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
          aria-label="Ouvrir le menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsMobileOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] h-full glass border-r border-zinc-200 p-6 flex flex-col">
            <button
              onClick={() => setIsMobileOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
              aria-label="Fermer le menu"
            >
              <X className="w-5 h-5" />
            </button>
            {navContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar: fixed, always visible from md up */}
      <aside className="hidden md:flex w-64 shrink-0 h-screen sticky top-0 flex-col glass border-r border-zinc-200 p-6">
        {navContent}
      </aside>
    </>
  );
}
