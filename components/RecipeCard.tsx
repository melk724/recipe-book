'use client';

import Link from 'next/link';
import { FavoriteHeart } from './FavoriteHeart';
import { categoryGradient, getCategoryMeta, TAG_LABELS } from '@/lib/categories';

export interface RecipeCardData {
  id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  category?: string | null;
  cuisine?: string | null;
  tags?: string[] | null;
  prep_time_minutes?: number | null;
  cook_time_minutes?: number | null;
  base_servings?: number | null;
  is_favorite?: boolean;
}

export function RecipeCard({ recipe, compact = false, onFavoriteChange }: { recipe: RecipeCardData; compact?: boolean; onFavoriteChange?: (recipeId: string, next: boolean) => void }) {
  const meta = getCategoryMeta(recipe.category);
  const totalTime = (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);
  const tags = (recipe.tags || []).slice(0, 2);

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="group bg-cream-card border border-ink/10 rounded-xl overflow-hidden flex flex-col hover:shadow-md hover:-translate-y-0.5 transition"
    >
      <div
        className="relative"
        style={{
          height: compact ? 90 : 130,
          background: recipe.image_url ? undefined : categoryGradient(recipe.category),
        }}
      >
        {recipe.image_url && (
          <img src={recipe.image_url} alt={recipe.title} className="w-full h-full object-cover" />
        )}
        <FavoriteHeart
          recipeId={recipe.id}
          initial={!!recipe.is_favorite}
          size={compact ? 26 : 32}
          onChange={onFavoriteChange ? (next) => onFavoriteChange(recipe.id, next) : undefined}
        />
      </div>
      <div className={`flex-1 ${compact ? 'p-2.5' : 'p-3.5'}`}>
        <h3 className={`font-medium ${compact ? 'text-sm' : 'text-[15px]'} leading-tight mb-1`}>
          {recipe.title}
        </h3>
        <div className={`text-ink-tertiary ${compact ? 'text-[10px]' : 'text-[11px]'} flex gap-1.5`}>
          {totalTime > 0 && (
            <>
              <span>{totalTime} min</span>
              <span>·</span>
            </>
          )}
          {recipe.cuisine && (
            <>
              <span>{recipe.cuisine}</span>
              <span>·</span>
            </>
          )}
          <span>{meta.label}</span>
        </div>
        {!compact && tags.length > 0 && (
          <div className="flex gap-1 mt-2 flex-wrap">
            {tags.map((t) => (
              <span
                key={t}
                className="text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded bg-terracotta/10 text-terracotta"
              >
                {TAG_LABELS[t] || t}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
