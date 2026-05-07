'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingCart, Plus, Heart } from 'lucide-react';

export function AppHeader({ onAddRecipe }: { onAddRecipe?: () => void }) {
  const pathname = usePathname();
  return (
    <header className="border-b border-ink/10 bg-cream-card/80 backdrop-blur-sm sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-terracotta flex items-center justify-center text-cream font-editorial-italic text-base">
            b
          </div>
          <span className="font-medium text-base sm:text-lg">Brian's Cookbook</span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/?filter=favorites"
            className={`p-2 sm:px-3 sm:py-1.5 rounded-full text-sm flex items-center gap-1.5 hover:bg-ink/5 ${pathname === '/' ? '' : ''}`}
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
        </div>
      </div>
    </header>
  );
}
