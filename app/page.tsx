'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { ImportModal } from '@/components/ImportModal';
import { AppHeader } from '@/components/AppHeader';
import { RecipeCard, RecipeCardData } from '@/components/RecipeCard';
import { CATEGORIES, getCategoryMeta } from '@/lib/categories';
import { Heart, Sparkles } from 'lucide-react';

const QUICK_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'quick', label: 'Quick (under 30 min)' },
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'make-ahead', label: 'Make-ahead' },
  { id: 'crowd-pleaser', label: 'Crowd-pleaser' },
  { id: 'weeknight', label: 'Weeknight' },
  { id: 'holiday', label: 'Holiday' },
];

export default function HomePage() {
  const [recipes, setRecipes] = useState<RecipeCardData[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'all' | 'favorites' | 'recent'>('all');
  const [spotifyToast, setSpotifyToast] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    loadRecipes();
    // Read URL query param for ?filter=favorites
    const params = new URLSearchParams(window.location.search);
    if (params.get('filter') === 'favorites') setActiveView('favorites');

    // Reload when the page becomes visible again (e.g. user came back from a detail page)
    function onVisible() {
      if (document.visibilityState === 'visible') loadRecipes();
    }
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', loadRecipes);

    // Spotify OAuth result
    const sp = params.get('spotify');
    if (sp === 'connected') {
      setSpotifyToast({ kind: 'success', msg: 'Spotify Premium connected. Open any recipe and start cooking!' });
      window.history.replaceState({}, '', '/');
      setTimeout(() => setSpotifyToast(null), 5000);
    } else if (sp === 'error') {
      const reason = params.get('reason') || 'unknown';
      const msg = reason === 'not_premium'
        ? 'Spotify connected, but you need Spotify Premium for in-app playback.'
        : `Spotify connection failed: ${reason}`;
      setSpotifyToast({ kind: 'error', msg });
      window.history.replaceState({}, '', '/');
      setTimeout(() => setSpotifyToast(null), 6000);
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', loadRecipes);
    };
  }, []);

  async function loadRecipes() {
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .order('created_at', { ascending: false });
    setRecipes(data || []);
    setLoading(false);
  }

  // Optimistic local update when a card's heart is toggled.
  // The supabase write itself happens inside FavoriteHeart.
  function handleFavoriteToggle(recipeId: string, next: boolean) {
    setRecipes((prev) => prev.map((r) => r.id === recipeId ? { ...r, is_favorite: next } : r));
  }

  // Filter pipeline
  const filteredRecipes = useMemo(() => {
    let r = recipes;
    if (activeView === 'favorites') r = r.filter((x) => x.is_favorite);
    if (activeView === 'recent') r = r.slice(0, 8);
    if (activeCategory) r = r.filter((x) => x.category === activeCategory);
    if (activeFilter !== 'all') {
      if (activeFilter === 'quick') {
        r = r.filter((x) => ((x.prep_time_minutes || 0) + (x.cook_time_minutes || 0)) <= 30);
      } else {
        r = r.filter((x) => (x.tags || []).includes(activeFilter));
      }
    }
    return r;
  }, [recipes, activeView, activeCategory, activeFilter]);

  // Group by category for "all" view
  const grouped = useMemo(() => {
    if (activeCategory || activeView !== 'all') return null;
    const m = new Map<string, RecipeCardData[]>();
    for (const r of filteredRecipes) {
      const cat = r.category || 'mains';
      if (!m.has(cat)) m.set(cat, []);
      m.get(cat)!.push(r);
    }
    return Array.from(m.entries()).sort((a, b) => {
      const ai = CATEGORIES.findIndex((c) => c.id === a[0]);
      const bi = CATEGORIES.findIndex((c) => c.id === b[0]);
      return ai - bi;
    });
  }, [filteredRecipes, activeCategory, activeView]);

  const favorites = recipes.filter((r) => r.is_favorite);
  const categoryCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of recipes) {
      const c = r.category || 'mains';
      m[c] = (m[c] || 0) + 1;
    }
    return m;
  }, [recipes]);

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader onAddRecipe={() => setImportOpen(true)} />

      {spotifyToast && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-30 px-4 py-3 rounded-lg shadow-lg max-w-md text-sm ${
          spotifyToast.kind === 'success' ? 'bg-sage text-white' : 'bg-terracotta text-cream'
        }`}>
          {spotifyToast.msg}
        </div>
      )}

      {loading ? (
        <div className="max-w-6xl mx-auto px-6 py-20 text-center text-ink-muted">Loading…</div>
      ) : recipes.length === 0 ? (
        <EmptyState onAdd={() => setImportOpen(true)} />
      ) : (
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8 grid lg:grid-cols-[200px_1fr] gap-6 lg:gap-8">
          {/* Sidebar */}
          <aside className="lg:sticky lg:top-20 lg:self-start space-y-1 text-sm">
            <SideSection label="Browse" />
            <SideItem
              active={activeView === 'all' && !activeCategory && activeFilter === 'all'}
              onClick={() => { setActiveView('all'); setActiveCategory(null); setActiveFilter('all'); }}
              count={recipes.length}
            >
              All recipes
            </SideItem>
            <SideItem
              active={activeView === 'recent'}
              onClick={() => { setActiveView('recent'); setActiveCategory(null); }}
              count={Math.min(recipes.length, 8)}
            >
              Recently added
            </SideItem>
            <SideItem
              active={activeView === 'favorites'}
              onClick={() => { setActiveView('favorites'); setActiveCategory(null); }}
              count={favorites.length}
            >
              <span className="flex items-center gap-1.5"><Heart size={12} fill={activeView === 'favorites' ? '#B8543A' : 'none'} /> Favorites</span>
            </SideItem>

            <SideSection label="Categories" />
            {CATEGORIES.filter((c) => categoryCounts[c.id]).map((c) => (
              <SideItem
                key={c.id}
                active={activeCategory === c.id}
                onClick={() => { setActiveCategory(activeCategory === c.id ? null : c.id); setActiveView('all'); }}
                count={categoryCounts[c.id]}
              >
                <span>{c.emoji}</span> {c.label}
              </SideItem>
            ))}
          </aside>

          {/* Main content */}
          <div className="min-w-0">
            {/* Hero — only show for "all" view */}
            {activeView === 'all' && !activeCategory && (
              <div className="mb-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-terracotta font-medium mb-2">
                  Library · {recipes.length} recipes
                </p>
                <h1 className="font-editorial-italic text-3xl sm:text-4xl mb-1">
                  Tonight, what shall we cook?
                </h1>
                <p className="text-sm text-ink-muted">
                  Your collection, scaled to whoever's at the table.
                </p>
              </div>
            )}
            {activeCategory && (
              <div className="mb-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-terracotta font-medium mb-2">
                  Category
                </p>
                <h1 className="font-editorial-italic text-3xl sm:text-4xl">
                  {getCategoryMeta(activeCategory).emoji} {getCategoryMeta(activeCategory).label}
                </h1>
              </div>
            )}
            {activeView === 'favorites' && (
              <div className="mb-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-terracotta font-medium mb-2">
                  Your keepers
                </p>
                <h1 className="font-editorial-italic text-3xl sm:text-4xl">Favorites</h1>
              </div>
            )}

            {/* Favorites shelf — only on All view, when there are some */}
            {activeView === 'all' && !activeCategory && favorites.length > 0 && (
              <FavoritesShelf favorites={favorites} onFavoriteChange={handleFavoriteToggle} />
            )}

            {/* Filter chips */}
            <div className="flex flex-wrap gap-1.5 mb-5 pb-4 border-b border-ink/10">
              {QUICK_FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
                    activeFilter === f.id
                      ? 'bg-ink text-cream border-ink'
                      : 'bg-cream-card border-ink/15 text-ink-soft hover:border-terracotta'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Results */}
            {filteredRecipes.length === 0 ? (
              <p className="text-ink-tertiary text-sm py-12 text-center">
                No recipes match these filters.
              </p>
            ) : grouped ? (
              <div className="space-y-7">
                {grouped.map(([cat, items]) => {
                  const meta = getCategoryMeta(cat);
                  return (
                    <section key={cat}>
                      <div className="flex items-baseline justify-between mb-2.5">
                        <h2 className="font-editorial-italic text-xl">{meta.label}</h2>
                        <span className="text-[10px] uppercase tracking-wider text-ink-tertiary">
                          {items.length} {items.length === 1 ? 'recipe' : 'recipes'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {items.map((r) => <RecipeCard key={r.id} recipe={r} compact onFavoriteChange={handleFavoriteToggle} />)}
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredRecipes.map((r) => <RecipeCard key={r.id} recipe={r} compact onFavoriteChange={handleFavoriteToggle} />)}
              </div>
            )}
          </div>
        </main>
      )}

      {importOpen && (
        <ImportModal
          onClose={() => setImportOpen(false)}
          onImported={() => { setImportOpen(false); loadRecipes(); }}
        />
      )}
    </div>
  );
}

function SideSection({ label }: { label: string }) {
  return (
    <div className="px-2 pt-4 pb-1.5 text-[10px] uppercase tracking-[0.18em] text-terracotta font-medium first:pt-0">
      {label}
    </div>
  );
}

function SideItem({
  children, count, active, onClick,
}: {
  children: React.ReactNode; count?: number; active?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2 py-1.5 rounded-md flex items-center justify-between text-sm transition ${
        active ? 'bg-terracotta/10 text-ink font-medium border-l-2 border-terracotta -ml-0.5 pl-[6px]' : 'hover:bg-ink/5 text-ink-soft'
      }`}
    >
      <span>{children}</span>
      {count !== undefined && <span className="text-[11px] text-ink-tertiary tnum">{count}</span>}
    </button>
  );
}

function FavoritesShelf({ favorites, onFavoriteChange }: { favorites: RecipeCardData[]; onFavoriteChange?: (recipeId: string, next: boolean) => void }) {
  return (
    <div className="mb-7 p-4 sm:p-5 rounded-xl bg-gradient-to-b from-terracotta/5 to-transparent border border-terracotta/15">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-editorial-italic text-base flex items-center gap-2">
          <Heart size={14} fill="#B8543A" stroke="#B8543A" />
          Your favorites
        </h3>
        <span className="text-[10px] uppercase tracking-wider text-ink-tertiary">
          {favorites.length} {favorites.length === 1 ? 'keeper' : 'keepers'}
        </span>
      </div>
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
        {favorites.slice(0, 12).map((r) => (
          <div key={r.id} className="flex-none w-[110px]">
            <RecipeCard recipe={r} compact onFavoriteChange={onFavoriteChange} />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="text-center py-20 px-6">
      <Sparkles size={48} className="mx-auto text-terracotta/40 mb-4" />
      <h2 className="font-editorial-italic text-3xl text-ink-soft mb-2">Your cookbook awaits</h2>
      <p className="text-ink-muted mb-6">Snap a photo, share a URL, or upload a PDF — Claude will read it and file it for you.</p>
      <button
        onClick={onAdd}
        className="px-6 py-3 rounded-full bg-ink text-cream font-medium hover:bg-ink-soft transition"
      >
        Add your first recipe
      </button>
    </div>
  );
}
