'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { addNote } from '@/lib/notes-photos';
import { X, Star, Loader2, ChefHat } from 'lucide-react';

const ENCOURAGEMENTS = [
  'Look at you go.',
  'Chef\'s kiss.',
  'Smells incredible from here.',
  'Hands washed, plate up!',
  'The kitchen wins again.',
  'You did the thing.',
  'A masterpiece.',
  'Hungry yet?',
];

export function CookCompleteModal({
  recipeId,
  recipeTitle,
  onClose,
}: {
  recipeId: string;
  recipeTitle: string;
  onClose: () => void;
}) {
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  // Pick a random encouragement that doesn't change on re-renders
  const [encouragement] = useState(
    () => ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]
  );

  // Confetti on mount
  useEffect(() => {
    fireConfetti();
  }, []);

  async function save() {
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const today = new Date().toISOString().split('T')[0];
      await addNote({
        recipeId,
        userId: user.id,
        noteType: 'session',
        content: comment.trim() || (rating ? `${rating} stars — cooked again` : 'Cooked again'),
        rating: rating || undefined,
        cookedAt: today,
      });
      setSaved(true);
      // Brief flourish before auto-closing
      setTimeout(() => onClose(), 900);
    } catch (e) {
      console.error(e);
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-ink/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      style={{ animation: 'modal-fade-in 0.2s ease-out' }}
    >
      <div
        className="bg-cream-card rounded-2xl max-w-md w-full p-7 relative shadow-xl"
        style={{ animation: 'modal-zoom-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      >
        <button
          onClick={onClose}
          disabled={busy}
          className="absolute top-4 right-4 text-ink-tertiary hover:text-ink"
        >
          <X size={18} />
        </button>

        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-terracotta to-gold mb-3 text-3xl">
            🎉
          </div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-terracotta font-medium mb-1">
            All done
          </p>
          <h2 className="font-editorial-italic text-3xl mb-1.5">{encouragement}</h2>
          <p className="text-sm text-ink-muted">
            You finished <span className="font-medium text-ink">{recipeTitle}</span>.
          </p>
        </div>

        {!saved ? (
          <>
            <div className="bg-cream rounded-xl p-4 mb-4">
              <p className="text-xs text-ink-muted mb-2.5 text-center">
                How'd it turn out?
              </p>
              <div className="flex justify-center gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHoverRating(n)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="w-9 h-9 flex items-center justify-center transition-transform hover:scale-110"
                    aria-label={`${n} stars`}
                  >
                    <Star
                      size={26}
                      className={
                        (hoverRating || rating) >= n
                          ? 'fill-gold stroke-gold transition-colors'
                          : 'fill-none stroke-ink/25 transition-colors'
                      }
                    />
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Anything to remember for next time? (optional)"
                maxLength={200}
                className="w-full px-3 py-2 rounded-lg border border-ink/15 bg-cream-card text-sm focus:border-terracotta outline-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                disabled={busy}
                className="flex-1 py-2.5 rounded-lg border border-ink/20 text-sm hover:bg-ink/5 disabled:opacity-50"
              >
                Skip & finish
              </button>
              <button
                onClick={save}
                disabled={busy}
                className="flex-1 py-2.5 rounded-lg bg-ink text-cream text-sm font-medium hover:bg-ink-soft disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <ChefHat size={14} />}
                {busy ? 'Saving…' : 'Save to cook log'}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-3">
            <p className="text-2xl mb-1">✓</p>
            <p className="text-sm text-ink-muted">Saved to your cook log.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Lightweight confetti — no library needed.
function fireConfetti() {
  const COLORS = ['#B8543A', '#D4A04C', '#7A9F4F', '#2A1F17', '#FAF6EF'];
  const PIECES = 60;
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:60;overflow:hidden;';
  document.body.appendChild(container);

  for (let i = 0; i < PIECES; i++) {
    const piece = document.createElement('div');
    const size = 6 + Math.random() * 8;
    const left = 10 + Math.random() * 80;
    const delay = Math.random() * 0.3;
    const duration = 2 + Math.random() * 1.5;
    const rotate = Math.random() * 720 - 360;
    const drift = (Math.random() - 0.5) * 200;
    piece.style.cssText = `
      position: absolute;
      left: ${left}vw;
      top: -20px;
      width: ${size}px;
      height: ${size * 1.4}px;
      background: ${COLORS[Math.floor(Math.random() * COLORS.length)]};
      border-radius: 2px;
      animation: confetti-fall ${duration}s ${delay}s ease-in forwards;
      --drift: ${drift}px;
      --rotate: ${rotate}deg;
    `;
    container.appendChild(piece);
  }

  // Inject keyframes once
  if (!document.getElementById('confetti-style')) {
    const style = document.createElement('style');
    style.id = 'confetti-style';
    style.textContent = `
      @keyframes confetti-fall {
        0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
        100% { transform: translate(var(--drift), 110vh) rotate(var(--rotate)); opacity: 0.4; }
      }
    `;
    document.head.appendChild(style);
  }

  // Cleanup after the animation
  setTimeout(() => container.remove(), 4500);
}
