'use client';

import { useState, useEffect, useRef } from 'react';
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
  const [showIngredients, setShowIngredients] = useState(true);

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

  return (
    <div className="space-y-4">
      <MusicBar recipeCuisine={recipe.cuisine} />

      <div className="bg-cream-card border border-ink/10 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowIngredients((v) => !v)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-ink/5"
        >
          <span className="text-[11px] uppercase tracking-[0.18em] text-ink-tertiary font-medium">
            Ingredients · for {servings}
          </span>
          <ChevronRight size={16} className={`transition ${showIngredients ? 'rotate-90' : ''}`} />
        </button>
        {showIngredients && (
          <div className="px-4 pb-3 text-sm">
            {scaledIngredients.map((i) => (
              <div key={i.id} className="flex justify-between py-1 border-b border-dashed border-ink/10 last:border-none">
                <span>{i.name}</span>
                <span className="text-ink-muted tnum">
                  {formatAmount(i.amount)}{i.unit ? ` ${i.unit}` : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {step && (
        <div className="bg-cream-card border border-ink/10 rounded-xl p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] uppercase tracking-[0.18em] text-terracotta font-medium">
              Step {stepIdx + 1} of {steps.length}
            </span>
            <div className="flex gap-1">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 w-6 rounded-full ${i <= stepIdx ? 'bg-terracotta' : 'bg-ink/15'}`}
                />
              ))}
            </div>
          </div>

          <p className="font-editorial text-xl sm:text-2xl leading-relaxed mb-4">
            {step.instruction}
          </p>

          {tip && (
            <div className="bg-terracotta/5 border-l-2 border-terracotta rounded-r-md p-3 mb-4 text-sm text-ink-soft">
              <span className="text-[10px] uppercase tracking-wider text-terracotta font-medium block mb-0.5">
                💡 Your tip
              </span>
              {tip.content}
            </div>
          )}

          {step.timer_seconds && <Timer seconds={step.timer_seconds} key={step.id} />}

          <div className="flex gap-2 mt-5">
            <button
              onClick={() => setStepIdx(Math.max(0, stepIdx - 1))}
              disabled={stepIdx === 0}
              className="px-4 py-2.5 rounded-lg border border-ink/20 text-sm flex items-center gap-1 disabled:opacity-30"
            >
              <ChevronLeft size={16} /> Back
            </button>
            <button
              onClick={() => setStepIdx(Math.min(steps.length - 1, stepIdx + 1))}
              disabled={stepIdx === steps.length - 1}
              className="flex-1 px-4 py-2.5 rounded-lg bg-ink text-cream text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50 hover:bg-ink-soft"
            >
              {stepIdx === steps.length - 1 ? '🎉 Done!' : <>Next <ChevronRight size={16} /></>}
            </button>
          </div>
        </div>
      )}

      {stepIdx < steps.length - 1 && (
        <div className="text-xs text-ink-tertiary px-1">
          Up next: <span className="text-ink-muted">{steps[stepIdx + 1].instruction.slice(0, 80)}{steps[stepIdx + 1].instruction.length > 80 ? '…' : ''}</span>
        </div>
      )}
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
      <div className="font-editorial-italic text-2xl tnum w-[80px]">
        {min}:{sec.toString().padStart(2, '0')}
      </div>
      <div className="flex-1 text-xs text-ink-muted">
        {done ? '✓ Time\'s up!' : running ? 'Counting down…' : `${Math.round(seconds / 60)} minute timer`}
      </div>
      {!done && (
        <button
          onClick={() => setRunning((v) => !v)}
          className="w-9 h-9 rounded-full bg-terracotta text-cream flex items-center justify-center hover:bg-terracotta-dark"
        >
          {running ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
        </button>
      )}
      <button
        onClick={reset}
        className="w-9 h-9 rounded-full border border-ink/15 hover:bg-ink/5 flex items-center justify-center text-ink-muted"
      >
        <RotateCcw size={13} />
      </button>
    </div>
  );
}
