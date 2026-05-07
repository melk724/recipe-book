'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { AppHeader } from '@/components/AppHeader';
import { FavoriteHeart } from '@/components/FavoriteHeart';
import { RecipeNotesPhotos } from '@/components/RecipeNotesPhotos';
import { CookMode } from '@/components/CookMode';
import { categoryGradient, getCategoryMeta, TAG_LABELS } from '@/lib/categories';
import { formatAmount, Ingredient, roundUpForShopping } from '@/lib/recipe-utils';
import { ArrowLeft, Minus, Plus, ShoppingCart, ChevronRight, MoreVertical, Trash2, Printer } from 'lucide-react';
import { DeleteRecipeModal } from '@/components/DeleteRecipeModal';

type Tab = 'recipe' | 'notes' | 'cook';

export default function RecipeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [recipe, setRecipe] = useState<any>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [steps, setSteps] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>('recipe');
  const [servings, setServings] = useState(4);
  const [hero, setHero] = useState<string | null>(null);
  const [pinnedNotes, setPinnedNotes] = useState<any[]>([]);
  const [stepNotes, setStepNotes] = useState<Record<number, any>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => { load(); }, [id]);

  // Close menu on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest?.('[data-recipe-menu]')) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  async function load() {
    const [rRes, iRes, sRes, pRes, nRes] = await Promise.all([
      supabase.from('recipes').select('*').eq('id', id).single(),
      supabase.from('ingredients').select('*').eq('recipe_id', id).order('position'),
      supabase.from('steps').select('*').eq('recipe_id', id).order('position'),
      supabase.from('recipe_photos').select('*').eq('recipe_id', id).eq('photo_type', 'hero').maybeSingle(),
      supabase.from('recipe_notes').select('*').eq('recipe_id', id),
    ]);
    if (rRes.data) {
      setRecipe(rRes.data);
      setServings(rRes.data.base_servings || 4);
    }
    setIngredients(iRes.data || []);
    setSteps(sRes.data || []);
    if (pRes.data) {
      const { data: { publicUrl } } = supabase.storage
        .from('recipe-images')
        .getPublicUrl(pRes.data.storage_path);
      setHero(publicUrl);
    }
    const notes = nRes.data || [];
    setPinnedNotes(notes.filter((n) => n.note_type === 'pinned'));
    const sm: Record<number, any> = {};
    for (const n of notes.filter((n) => n.note_type === 'step')) {
      if (n.step_position !== null) sm[n.step_position] = n;
    }
    setStepNotes(sm);
  }

  const scaledIngredients = useMemo(() => {
    if (!recipe) return [];
    const mult = servings / (recipe.base_servings || 1);
    return ingredients.map((i) => ({
      ...i,
      amount: i.amount !== null ? sensibleRound(i.amount * mult) : null,
    }));
  }, [recipe, ingredients, servings]);

  async function addToShoppingList() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Get or create the user's shopping list
    let { data: list } = await supabase
      .from('shopping_lists')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!list) {
      const { data: newList } = await supabase
        .from('shopping_lists')
        .insert({ user_id: user.id, name: 'My Shopping List' })
        .select()
        .single();
      list = newList;
    }
    if (!list) return;

    // Fetch existing items so we can merge by name+unit
    const { data: existing } = await supabase
      .from('shopping_list_items')
      .select('*')
      .eq('list_id', list.id);
    const existingMap = new Map<string, any>();
    for (const it of existing || []) {
      const key = makeMergeKey(it.ingredient_name, it.unit);
      existingMap.set(key, it);
    }

    let mergedCount = 0;
    let addedCount = 0;
    const toUpdate: { id: string; amount: number | null }[] = [];
    const toInsert: any[] = [];

    for (const i of scaledIngredients) {
      const key = makeMergeKey(i.name, i.unit);
      const match = existingMap.get(key);
      if (match) {
        // Sum amounts (treating null as 0 for arithmetic, but keep null if both null)
        const a = typeof match.amount === 'number' ? match.amount : null;
        const b = typeof i.amount === 'number' ? i.amount : null;
        let combined: number | null;
        if (a === null && b === null) combined = null;
        else combined = (a || 0) + (b || 0);
        // Round up to a friendly shopping quantity (works for whole items AND measured)
        combined = roundUpForShopping(combined, i.unit);
        toUpdate.push({ id: match.id, amount: combined });
        mergedCount++;
      } else {
        // New item — also round up to friendly quantity
        const amt = roundUpForShopping(typeof i.amount === 'number' ? i.amount : null, i.unit);
        toInsert.push({
          list_id: list!.id,
          recipe_id: recipe.id,
          ingredient_name: i.name,
          amount: amt,
          unit: i.unit,
          category: i.category || 'other',
          servings_multiplier: servings / (recipe.base_servings || 1),
        });
        addedCount++;
      }
    }

    // Apply updates and inserts
    for (const u of toUpdate) {
      // After merging from a different recipe, clear recipe_id so the item isn't
      // accidentally deleted if either source recipe is deleted.
      await supabase.from('shopping_list_items')
        .update({ amount: u.amount, recipe_id: null })
        .eq('id', u.id);
    }
    if (toInsert.length) {
      await supabase.from('shopping_list_items').insert(toInsert);
    }

    if (mergedCount && addedCount) {
      alert(`Added ${addedCount} new and combined ${mergedCount} existing items in your shopping list.`);
    } else if (mergedCount) {
      alert(`Combined ${mergedCount} ${mergedCount === 1 ? 'item' : 'items'} with what's already in your shopping list.`);
    } else {
      alert(`Added ${addedCount} ingredients to your shopping list.`);
    }
  }

  // Build a normalized key so "Yellow Onion" + null unit matches "yellow onion" + null unit
  function makeMergeKey(name: string, unit: string | null | undefined): string {
    return `${name.trim().toLowerCase()}|${(unit || '').trim().toLowerCase()}`;
  }

  if (!recipe) {
    return (
      <div className="min-h-screen bg-cream">
        <AppHeader />
        <div className="max-w-4xl mx-auto p-6 text-ink-muted">Loading…</div>
      </div>
    );
  }

  const meta = getCategoryMeta(recipe.category);
  const totalTime = (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-4 no-print">
          <button
            onClick={() => router.push('/')}
            className="text-sm text-ink-muted hover:text-ink flex items-center gap-1"
          >
            <ArrowLeft size={14} /> All recipes
          </button>
          <div className="relative" data-recipe-menu>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Recipe options"
              className="w-9 h-9 rounded-full hover:bg-ink/5 flex items-center justify-center text-ink-muted"
            >
              <MoreVertical size={18} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-cream-card border border-ink/10 rounded-lg shadow-lg overflow-hidden min-w-[180px] z-30">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setTab('recipe');
                    // Wait a tick for the tab to render, then trigger print
                    setTimeout(() => window.print(), 100);
                  }}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-ink/5 flex items-center gap-2"
                >
                  <Printer size={14} /> Print recipe
                </button>
                <button
                  onClick={() => { setMenuOpen(false); setShowDelete(true); }}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-terracotta/5 text-terracotta flex items-center gap-2 border-t border-ink/10"
                >
                  <Trash2 size={14} /> Delete recipe
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-ink/10 mb-5 no-print">
          <TabBtn active={tab === 'recipe'} onClick={() => setTab('recipe')}>Recipe</TabBtn>
          <TabBtn active={tab === 'notes'} onClick={() => setTab('notes')}>Notes &amp; Photos</TabBtn>
          <TabBtn active={tab === 'cook'} onClick={() => setTab('cook')}>Cook</TabBtn>
        </div>

        {tab === 'recipe' && (
          <div className="bg-cream-card border border-ink/10 rounded-2xl overflow-hidden grid md:grid-cols-[260px_1fr]">
            {/* Hero */}
            <div
              className="relative min-h-[220px] md:min-h-[380px]"
              style={{ background: hero ? undefined : categoryGradient(recipe.category) }}
            >
              {hero && <img src={hero} alt={recipe.title} className="absolute inset-0 w-full h-full object-cover" />}
              <div className="no-print">
                <FavoriteHeart recipeId={recipe.id} initial={!!recipe.is_favorite} />
              </div>
            </div>
            {/* Body */}
            <div className="p-6">
              <p className="text-[11px] uppercase tracking-[0.18em] text-terracotta font-medium mb-1">
                {recipe.cuisine ? `${recipe.cuisine} · ` : ''}{meta.label}
              </p>
              <h1 className="font-editorial-italic text-3xl mb-1.5">{recipe.title}</h1>
              {recipe.description && (
                <p className="text-sm text-ink-muted mb-4">{recipe.description}</p>
              )}

              {/* Tags */}
              {recipe.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {recipe.tags.map((t: string) => (
                    <span
                      key={t}
                      className="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full bg-terracotta/10 text-terracotta"
                    >
                      {TAG_LABELS[t] || t}
                    </span>
                  ))}
                </div>
              )}

              {/* Pinned notes */}
              {pinnedNotes.map((n) => (
                <div
                  key={n.id}
                  className="bg-gold-soft border-l-2 border-gold rounded-r-md p-3 mb-3 text-sm italic font-editorial text-ink-soft"
                >
                  <span className="text-[10px] uppercase tracking-wider text-terracotta font-medium not-italic font-sans block mb-0.5">
                    📌 Pinned
                  </span>
                  {n.content}
                </div>
              ))}

              {/* Stats */}
              <div className="flex gap-5 py-3 border-y border-ink/10 mb-4">
                {recipe.prep_time_minutes && <Stat num={recipe.prep_time_minutes} unit="min" label="Prep" />}
                {recipe.cook_time_minutes && <Stat num={recipe.cook_time_minutes} unit="min" label="Cook" />}
                <Stat num={steps.length} label="Steps" />
              </div>

              {/* Servings stepper */}
              <div className="flex items-center gap-3 px-3 py-2.5 bg-terracotta/5 rounded-lg mb-4">
                <label className="text-xs text-ink-muted font-medium">Cooking for</label>
                <div className="flex items-center gap-1 ml-auto">
                  <Stepper onClick={() => setServings(Math.max(1, servings - 1))} className="no-print"><Minus size={12} /></Stepper>
                  <span className="font-editorial-italic text-lg font-medium min-w-[28px] text-center tnum">
                    {servings}
                  </span>
                  <Stepper onClick={() => setServings(Math.min(24, servings + 1))} className="no-print"><Plus size={12} /></Stepper>
                </div>
              </div>

              {/* Ingredients */}
              <div className="text-sm">
                {scaledIngredients.map((i) => (
                  <div key={i.id} className="flex justify-between py-1.5 border-b border-dashed border-ink/10 last:border-none">
                    <span>{i.name}{i.notes ? `, ${i.notes}` : ''}</span>
                    <span className="text-ink-muted tnum">
                      {formatAmount(i.amount)}{i.unit ? ` ${i.unit}` : ''}
                    </span>
                  </div>
                ))}
              </div>

              {/* Print-only: steps appear inline */}
              <div className="print-only mt-6">
                <h3 className="font-editorial-italic text-xl mb-2">Steps</h3>
                <ol className="space-y-2">
                  {steps.map((s, i) => (
                    <li key={s.id} className="flex gap-2 text-sm">
                      <span className="font-medium text-ink tnum">{i + 1}.</span>
                      <span>{s.instruction}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-5 no-print">
                <button
                  onClick={addToShoppingList}
                  className="px-4 py-2.5 rounded-lg border border-ink/20 text-sm flex items-center gap-1.5 hover:bg-ink/5"
                >
                  <ShoppingCart size={14} /> Shopping
                </button>
                <button
                  onClick={() => setTab('cook')}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-ink text-cream text-sm font-medium flex items-center justify-center gap-1.5 hover:bg-ink-soft"
                >
                  Start cooking <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'notes' && (
          <div className="no-print">
            <RecipeNotesPhotos recipe={recipe} steps={steps} onChange={load} />
          </div>
        )}

        {tab === 'cook' && (
          <div className="no-print">
            <CookMode
              recipe={recipe}
              scaledIngredients={scaledIngredients}
              steps={steps}
              stepNotes={stepNotes}
              servings={servings}
            />
          </div>
        )}
      </main>

      {showDelete && (
        <DeleteRecipeModal
          recipeId={recipe.id}
          recipeTitle={recipe.title}
          onClose={() => setShowDelete(false)}
          onDeleted={() => router.push('/')}
        />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 text-xs uppercase tracking-[0.12em] font-medium border-b-2 -mb-px transition ${
        active ? 'border-terracotta text-terracotta' : 'border-transparent text-ink-tertiary hover:text-ink-soft'
      }`}
    >
      {children}
    </button>
  );
}

function Stat({ num, unit, label }: { num: number; unit?: string; label: string }) {
  return (
    <div>
      <div className="font-editorial-italic text-lg font-medium leading-none tnum">
        {num}{unit && <span className="text-[11px] not-italic font-sans ml-0.5">{unit}</span>}
      </div>
      <div className="text-[10px] uppercase tracking-[0.12em] text-ink-tertiary mt-1">{label}</div>
    </div>
  );
}

function Stepper({ onClick, children, className = '' }: { onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-7 h-7 rounded-full border border-ink/20 bg-cream-card hover:border-terracotta hover:text-terracotta flex items-center justify-center ${className}`}
    >
      {children}
    </button>
  );
}

function sensibleRound(n: number): number {
  if (n < 0.125) return Math.round(n * 100) / 100;
  if (n < 1) {
    const fractions = [0.125, 0.25, 0.333, 0.5, 0.667, 0.75];
    return fractions.reduce((p, c) => Math.abs(c - n) < Math.abs(p - n) ? c : p);
  }
  if (n < 10) return Math.round(n * 4) / 4;
  return Math.round(n);
}
