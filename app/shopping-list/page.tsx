'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { AppHeader } from '@/components/AppHeader';
import { formatAmount } from '@/lib/recipe-utils';
import { Trash2, Check } from 'lucide-react';

const CATEGORY_ORDER = ['produce', 'dairy', 'meat', 'seafood', 'pantry', 'spices', 'bakery', 'frozen', 'beverages', 'other'];
const CATEGORY_LABELS: Record<string, string> = {
  produce: 'Produce',
  dairy: 'Dairy',
  meat: 'Meat',
  seafood: 'Seafood',
  pantry: 'Pantry',
  spices: 'Spices',
  bakery: 'Bakery',
  frozen: 'Frozen',
  beverages: 'Beverages',
  other: 'Other',
};

export default function ShoppingListPage() {
  const [items, setItems] = useState<any[]>([]);
  const [list, setList] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    // Single-user mode: just grab the most recent shopping list.
    // (When auth is added, filter by user_id here.)
    let { data: l } = await supabase
      .from('shopping_lists')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setList(l);
    if (l) {
      const { data } = await supabase.from('shopping_list_items').select('*').eq('list_id', l.id);
      setItems(data || []);
    }
    setLoading(false);
  }

  async function toggleChecked(id: string, checked: boolean) {
    setItems((arr) => arr.map((i) => i.id === id ? { ...i, checked } : i));
    await supabase.from('shopping_list_items').update({ checked }).eq('id', id);
  }

  async function removeItem(id: string) {
    setItems((arr) => arr.filter((i) => i.id !== id));
    await supabase.from('shopping_list_items').delete().eq('id', id);
  }

  async function clearChecked() {
    if (!confirm('Remove all checked items?')) return;
    const ids = items.filter((i) => i.checked).map((i) => i.id);
    setItems((arr) => arr.filter((i) => !i.checked));
    if (ids.length) await supabase.from('shopping_list_items').delete().in('id', ids);
  }

  async function clearAll() {
    if (!confirm('Clear the entire list?')) return;
    setItems([]);
    if (list) await supabase.from('shopping_list_items').delete().eq('list_id', list.id);
  }

  const grouped: Record<string, any[]> = {};
  for (const i of items) {
    const c = i.category || 'other';
    if (!grouped[c]) grouped[c] = [];
    grouped[c].push(i);
  }
  const sortedCats = Object.keys(grouped).sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const checkedCount = items.filter((i) => i.checked).length;

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        <p className="text-[11px] uppercase tracking-[0.18em] text-terracotta font-medium mb-2">
          Shopping list
        </p>
        <h1 className="font-editorial-italic text-3xl sm:text-4xl mb-1">This week's list</h1>
        <p className="text-sm text-ink-muted mb-6">
          {items.length === 0 ? 'Empty for now — add items from any recipe.' :
            `${items.length} items, ${checkedCount} checked off.`}
        </p>

        {loading ? (
          <div className="text-ink-muted">Loading…</div>
        ) : items.length === 0 ? (
          <div className="bg-cream-card border border-ink/10 rounded-xl p-8 text-center">
            <p className="text-ink-muted text-sm mb-3">
              Open any recipe and tap "Shopping" to add ingredients here.
            </p>
            <a href="/" className="text-sm text-terracotta hover:text-terracotta-dark font-medium">
              Browse recipes →
            </a>
          </div>
        ) : (
          <>
            <div className="bg-cream-card border border-ink/10 rounded-xl overflow-hidden">
              {sortedCats.map((cat) => (
                <div key={cat} className="border-b border-ink/10 last:border-none">
                  <div className="px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-terracotta font-medium bg-terracotta/5">
                    {CATEGORY_LABELS[cat] || cat}
                  </div>
                  {grouped[cat].map((i) => (
                    <label
                      key={i.id}
                      className={`flex items-center gap-3 px-4 py-2.5 hover:bg-ink/5 cursor-pointer text-sm border-b border-ink/5 last:border-none group ${i.checked ? 'text-ink-tertiary line-through' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={i.checked}
                        onChange={(e) => toggleChecked(i.id, e.target.checked)}
                        className="w-4 h-4 accent-terracotta cursor-pointer"
                      />
                      <span className="flex-1">{i.ingredient_name}</span>
                      <span className="tnum text-xs text-ink-muted">
                        {formatAmount(i.amount)}{i.unit ? ` ${i.unit}` : ''}
                      </span>
                      <button
                        onClick={(e) => { e.preventDefault(); removeItem(i.id); }}
                        className="opacity-0 group-hover:opacity-100 text-ink-tertiary hover:text-terracotta"
                      >
                        <Trash2 size={13} />
                      </button>
                    </label>
                  ))}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-4 text-xs">
              {checkedCount > 0 && (
                <button onClick={clearChecked} className="text-ink-muted hover:text-terracotta flex items-center gap-1">
                  <Check size={12} /> Clear {checkedCount} checked
                </button>
              )}
              <button onClick={clearAll} className="text-ink-muted hover:text-terracotta flex items-center gap-1">
                <Trash2 size={12} /> Clear all
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
