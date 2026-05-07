'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Trash2, X, AlertTriangle, Loader2 } from 'lucide-react';

export function DeleteRecipeModal({
  recipeId, recipeTitle, onClose, onDeleted,
}: {
  recipeId: string;
  recipeTitle: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [removeFromList, setRemoveFromList] = useState(false);
  const [shoppingItemCount, setShoppingItemCount] = useState<number | null>(null);

  // Find out how many shopping list items came from this recipe
  useEffect(() => {
    (async () => {
      const { count } = await supabase
        .from('shopping_list_items')
        .select('id', { count: 'exact', head: true })
        .eq('recipe_id', recipeId);
      setShoppingItemCount(count || 0);
    })();
  }, [recipeId]);

  async function confirmDelete() {
    setBusy(true);
    setError('');
    try {
      // Delete shopping list items first if requested
      if (removeFromList && shoppingItemCount && shoppingItemCount > 0) {
        await supabase.from('shopping_list_items').delete().eq('recipe_id', recipeId);
      }
      // Delete photos from storage
      const { data: photos } = await supabase
        .from('recipe_photos')
        .select('storage_path')
        .eq('recipe_id', recipeId);
      if (photos && photos.length > 0) {
        await supabase.storage.from('recipe-images').remove(photos.map((p) => p.storage_path));
      }
      // Delete the recipe — cascades to ingredients, steps, notes, photos via FK
      const { error: dErr } = await supabase.from('recipes').delete().eq('id', recipeId);
      if (dErr) throw dErr;
      onDeleted();
    } catch (e: any) {
      setError(e.message || 'Failed to delete');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-cream-card rounded-2xl max-w-sm w-full p-6 relative shadow-xl">
        <button
          onClick={onClose}
          disabled={busy}
          className="absolute top-4 right-4 text-ink-tertiary hover:text-ink"
        >
          <X size={18} />
        </button>

        <div className="w-11 h-11 rounded-full bg-terracotta/10 flex items-center justify-center mb-3">
          <AlertTriangle size={20} className="text-terracotta" />
        </div>
        <h2 className="font-editorial-italic text-2xl mb-1">Delete this recipe?</h2>
        <p className="text-sm text-ink-muted mb-4">
          <span className="font-medium text-ink">{recipeTitle}</span> and all its notes, photos, and step tips will be permanently removed. This can't be undone.
        </p>

        {shoppingItemCount !== null && shoppingItemCount > 0 && (
          <label className="flex items-start gap-3 p-3 rounded-lg bg-terracotta/5 border border-terracotta/15 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={removeFromList}
              onChange={(e) => setRemoveFromList(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-terracotta cursor-pointer"
            />
            <span className="text-sm text-ink-soft">
              Also remove the <span className="font-medium text-ink">{shoppingItemCount}</span> {shoppingItemCount === 1 ? 'item' : 'items'} from this recipe in your shopping list
            </span>
          </label>
        )}

        {error && (
          <div className="mb-4 p-3 bg-terracotta/10 border border-terracotta/30 rounded-lg text-sm text-terracotta-dark">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 py-2.5 rounded-lg border border-ink/20 text-sm hover:bg-ink/5 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={confirmDelete}
            disabled={busy}
            className="flex-1 py-2.5 rounded-lg bg-terracotta text-cream text-sm font-medium hover:bg-terracotta-dark disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {busy ? 'Deleting…' : 'Delete recipe'}
          </button>
        </div>
      </div>
    </div>
  );
}
