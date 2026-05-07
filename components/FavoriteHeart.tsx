'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export function FavoriteHeart({
  recipeId,
  initial,
  size = 32,
  onChange,
}: {
  recipeId: string;
  initial: boolean;
  size?: number;
  onChange?: (next: boolean) => void;
}) {
  const [on, setOn] = useState(initial);
  const [pulse, setPulse] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !on;
    setOn(next);
    setPulse(true);
    setTimeout(() => setPulse(false), 400);
    onChange?.(next);
    try {
      await supabase.from('recipes').update({ is_favorite: next }).eq('id', recipeId);
    } catch (err) {
      // Revert on error
      setOn(!next);
      console.error(err);
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={on ? 'Remove from favorites' : 'Add to favorites'}
      className={`absolute top-2.5 right-2.5 rounded-full bg-cream-card/90 backdrop-blur-sm flex items-center justify-center transition hover:scale-110 active:scale-95 ${pulse ? 'heart-pulse' : ''}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size * 0.5}
        height={size * 0.5}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 21s-7-4.5-9.5-9C1 9 2.5 5 6.5 5c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3C21.5 5 23 9 21.5 12c-2.5 4.5-9.5 9-9.5 9z"
          fill={on ? '#B8543A' : 'none'}
          stroke={on ? '#B8543A' : '#2A1F17'}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
