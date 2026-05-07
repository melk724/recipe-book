'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Ingredient, formatAmount } from '@/lib/recipe-utils';
import { MusicBar } from './MusicBar';
import { ChevronLeft, ChevronRight, Play, Pause, RotateCcw } from 'lucide-react';

export function CookMode({
  recipe, scaledIngredients, steps, stepNotes, servings,
}: {
  recipe: any;
  scaledIngredients: Ingredient[];
  steps: any[];
  stepNotes: Record<number, any>;
  servings: number;
}) {
  const [stepIdx, setStepIdx] = useState(0);

  // Wake lock — keep screen on while cooking
  useEffect(() => {
    let wl: any = null;
    if ('wakeLock' in navigator) {
      // @ts-ignore
      navigator.wakeLock?.request?.('screen').then((w: any) => { wl = w; }).catch(() => {});
    }
    return () => { wl?.release?.(); };
  }, []);

  const step = steps[stepIdx];
  const tip = step ? stepNotes[step.position] : null;

  // Determine which ingredients are mentioned in this step's text.
  // Returns a Set of ingredient ids that should be highlighted.
  const stepIngredientIds = useMemo(() => {
    if (!step) return new Set<string>();
    const text = step.instruction.toLowerCase();
    const matched = new Set<string>();
    for (const ing of scaledIngredients) {
      if (!ing.id || !ing.name) continue;
      // Match the main noun of the ingredient, not modifier words
      // e.g. "yellow onion, diced" → check for "onion"
      const cleanName = ing.name
        .toLowerCase()
        .replace(/,.*$/, '') // strip everything after first comma
        .trim();
      // Try the full clean name first
      if (cleanName.length >= 3 && text.includes(cleanName)) {
        matched.add(ing.id);
        continue;
      }
      // Then try the last word (often the noun: "yellow onion" → "onion")
      const words = cleanName.split(/\s+/).filter((w) => w.length >= 4);
      const lastWord = words[words.length - 1];
      if (lastWord && text.includes(lastWord)) {
        matched.add(ing.id);
      }
    }
    return matched;
  }, [step, scaledIngredients]);

  const showHighlights = stepIngredientIds.size > 0 && stepIngredientIds.size < scaledIngredients.length;

  return (
    <div className="space-y-4">
      {/* Music — full width at top */}
      <MusicBar recipeCuisine={recipe.cuisine} />

      {/* Side-by-side cooking layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* LEFT — Ingredients column */}
        <aside className="bg-cream-card border border-ink/10 rounded-xl p-4 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-[11px] uppercase tracking-[0.18em] text-ink-tertiary font-medium">
              Ingredients
            </span>
            <span className="text-[10px] text-ink-tertiary">for {servings}</span>
          </div>
          {showHighlights && (
            <p className="text-[10px] text-ink-tertiary italic mb-2">
              {stepIngredientIds.size} used in this step
            </p>
          )}
          <div className="text-sm space-y-0">
            {scaledIngredients.map((i) => {
              const isInStep = i.id && stepIngredientIds.has(i.id);
              const dim = showHighlights && !isInStep;
              return (
                <div
                  key={i.id}
                  className={`flex justify-between gap-2 py-1.5 border-b border-dashed border-ink/10 last:border-none transition-opacity ${dim ? 'opacity-30' : ''}`}
                >
                  <span className={`leading-tight ${isInStep ? 'font-medium' : ''}`}>
                    {i.name}
                    {i.notes ? <span className="text-ink-tertiary text-xs">, {i.notes}</span> : ''}
                  </span>
                  <span className="text-ink-muted tnum text-xs flex-none whitespace-nowrap">
                    {formatAmount(i.amount)}{i.unit ? ` ${i.unit}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </aside>

        {/* RIGHT — Current step (the focus) */}
        <div className="space-y-3">
          {step && (
            <div className="bg-cream-card border border-ink/10 rounded-xl p-6 sm:p-8">
              <div className="flex items-center justify-between mb-5">
                <span className="text-[11px] uppercase tracking-[0.18em] text-terracotta font-medium">
                  Step {stepIdx + 1} of {steps.length}
                </span>
                <div className="flex gap-1">
                  {steps.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 w-6 rounded-full transition-colors ${i <= stepIdx ? 'bg-terracotta' : 'bg-ink/15'}`}
                    />
                  ))}
                </div>
              </div>

              <p className="font-editorial text-2xl sm:text-3xl leading-relaxed mb-5">
                {step.instruction}
              </p>

              {tip && (
                <div className="bg-terracotta/5 border-l-2 border-terracotta rounded-r-md p-3 mb-5 text-sm text-ink-soft">
                  <span className="text-[10px] uppercase tracking-wider text-terracotta font-medium block mb-0.5">
                    💡 Your tip
                  </span>
                  {tip.content}
                </div>
              )}

              {step.timer_seconds && <Timer seconds={step.timer_seconds} key={step.id} />}

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setStepIdx(Math.max(0, stepIdx - 1))}
                  disabled={stepIdx === 0}
                  className="px-5 py-3 rounded-lg border border-ink/20 text-sm flex items-center gap-1 disabled:opacity-30 hover:bg-ink/5"
                >
                  <ChevronLeft size={16} /> Back
                </button>
                <button
                  onClick={() => setStepIdx(Math.min(steps.length - 1, stepIdx + 1))}
                  disabled={stepIdx === steps.length - 1}
                  className="flex-1 px-5 py-3 rounded-lg bg-ink text-cream text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50 hover:bg-ink-soft"
                >
                  {stepIdx === steps.length - 1 ? '🎉 Done!' : <>Next <ChevronRight size={16} /></>}
                </button>
              </div>
            </div>
          )}

          {/* Up next preview */}
          {stepIdx < steps.length - 1 && (
            <div className="text-xs text-ink-tertiary px-1 italic">
              Up next: <span className="text-ink-muted not-italic">{steps[stepIdx + 1].instruction.slice(0, 100)}{steps[stepIdx + 1].instruction.length > 100 ? '…' : ''}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Timer({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(intervalRef.current);
          setRunning(false);
          setDone(true);
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.frequency.value = 880;
            g.gain.setValueAtTime(0.3, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
            o.start(); o.stop(ctx.currentTime + 1.5);
          } catch {}
          if ('vibrate' in navigator) navigator.vibrate?.([200, 100, 200, 100, 400]);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running]);

  function reset() {
    setRemaining(seconds);
    setRunning(false);
    setDone(false);
  }

  const min = Math.floor(remaining / 60);
  const sec = remaining % 60;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${done ? 'bg-sage/15 border border-sage' : 'bg-ink/5 border border-ink/10'}`}>
      <div className="font-editorial-italic text-3xl tnum w-[100px]">
        {min}:{sec.toString().padStart(2, '0')}
      </div>
      <div className="flex-1 text-xs text-ink-muted">
        {done ? '✓ Time\'s up!' : running ? 'Counting down…' : `${Math.round(seconds / 60)} minute timer`}
      </div>
      {!done && (
        <button
          onClick={() => setRunning((v) => !v)}
          className="w-10 h-10 rounded-full bg-terracotta text-cream flex items-center justify-center hover:bg-terracotta-dark"
          aria-label={running ? 'Pause' : 'Play'}
        >
          {running ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>
      )}
      <button
        onClick={reset}
        className="w-10 h-10 rounded-full border border-ink/15 hover:bg-ink/5 flex items-center justify-center text-ink-muted"
        aria-label="Reset timer"
      >
        <RotateCcw size={14} />
      </button>
    </div>
  );
}
