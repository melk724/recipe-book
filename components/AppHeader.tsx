'use client';

import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { ShoppingCart, Plus, Heart, LogOut } from 'lucide-react';

export function AppHeader({ onAddRecipe }: { onAddRecipe?: () => void }) {
  const [user, setUser] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const initial = user?.email?.[0]?.toUpperCase() || '?';
  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'You';

  return (
    <header className="border-b border-ink/10 bg-cream-card/80 backdrop-blur-sm sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-terracotta flex items-center justify-center text-cream font-editorial-italic text-base">
            b
          </div>
          <span className="font-medium text-base sm:text-lg">{displayName}'s Cookbook</span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/?filter=favorites"
            className="p-2 sm:px-3 sm:py-1.5 rounded-full text-sm flex items-center gap-1.5 hover:bg-ink/5"
            aria-label="Favorites"
          >
            <Heart size={16} />
            <span className="hidden sm:inline">Favorites</span>
          </Link>
          <Link
            href="/shopping-list"
            className="p-2 sm:px-3 sm:py-1.5 rounded-full text-sm flex items-center gap-1.5 hover:bg-ink/5"
            aria-label="Shopping list"
          >
            <ShoppingCart size={16} />
            <span className="hidden sm:inline">List</span>
          </Link>
          {onAddRecipe && (
            <button
              onClick={onAddRecipe}
              className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-ink text-cream text-sm font-medium flex items-center gap-1.5 hover:bg-ink-soft transition"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Recipe</span>
            </button>
          )}
          {user && (
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="w-9 h-9 rounded-full bg-terracotta/15 hover:bg-terracotta/25 text-terracotta font-medium text-sm flex items-center justify-center transition"
                aria-label="Account menu"
              >
                {initial}
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 bg-cream-card border border-ink/10 rounded-lg shadow-lg overflow-hidden min-w-[180px] z-30">
                  <div className="px-3 py-2.5 border-b border-ink/10">
                    <div className="text-xs font-medium">{displayName}</div>
                    <div className="text-[11px] text-ink-tertiary truncate">{user.email}</div>
                  </div>
                  <form action="/api/auth/signout" method="POST">
                    <button
                      type="submit"
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-ink/5 flex items-center gap-2"
                    >
                      <LogOut size={14} /> Sign out
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
