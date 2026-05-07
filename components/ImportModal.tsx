'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Camera, Image as ImageIcon, FileText, Link2, X, Loader2, Sparkles } from 'lucide-react';

type Source = 'camera' | 'upload' | 'pdf' | 'url' | null;

export function ImportModal({
  onClose, onImported,
}: { onClose: () => void; onImported: () => void }) {
  const [source, setSource] = useState<Source>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: File[], sourceType: 'image' | 'pdf' | 'camera') {
    if (!files.length) return;
    setBusy(true);
    setBusyMsg(files.length > 1
      ? `Reading ${files.length} pages…`
      : 'Reading your recipe…');
    setError('');
    try {
      // For multiple images, send them as an array. PDFs are always single-file.
      if (sourceType === 'pdf' || files.length === 1) {
        const data = await fileToBase64(files[0]);
        const res = await fetch('/api/recipes/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceType, data, mediaType: files[0].type }),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Import failed');
        const { recipe } = await res.json();
        setBusyMsg('Saving to your cookbook…');
        await saveRecipe(recipe, sourceType);
      } else {
        // Multi-image import
        const images = await Promise.all(
          files.map(async (f) => ({
            data: await fileToBase64(f),
            mediaType: f.type,
          }))
        );
        const res = await fetch('/api/recipes/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceType, images }),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Import failed');
        const { recipe } = await res.json();
        setBusyMsg('Saving to your cookbook…');
        await saveRecipe(recipe, sourceType);
      }
      onImported();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleUrl() {
    if (!url.trim()) return;
    setBusy(true);
    setBusyMsg('Fetching the recipe…');
    setError('');
    try {
      const res = await fetch('/api/recipes/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceType: 'url', url }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Import failed');
      const { recipe } = await res.json();
      setBusyMsg('Saving to your cookbook…');
      await saveRecipe(recipe, 'url', url);
      onImported();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveRecipe(recipe: any, sourceType: string, sourceUrl?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('You must be signed in to save recipes');
    const { data: saved, error: rErr } = await supabase
      .from('recipes')
      .insert({
        user_id: user.id,
        title: recipe.title,
        description: recipe.description,
        source_type: sourceType,
        source_url: sourceUrl,
        base_servings: recipe.base_servings,
        prep_time_minutes: recipe.prep_time_minutes,
        cook_time_minutes: recipe.cook_time_minutes,
        category: recipe.category,
        cuisine: recipe.cuisine,
        tags: recipe.tags,
      })
      .select()
      .single();
    if (rErr) throw rErr;
    if (recipe.ingredients?.length) {
      await supabase.from('ingredients').insert(
        recipe.ingredients.map((i: any, idx: number) => ({
          recipe_id: saved.id, position: idx, ...i,
        }))
      );
    }
    if (recipe.steps?.length) {
      await supabase.from('steps').insert(
        recipe.steps.map((s: any, idx: number) => ({
          recipe_id: saved.id, position: idx, ...s,
        }))
      );
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-cream-card rounded-2xl max-w-md w-full p-6 relative shadow-xl">
        <button
          onClick={onClose}
          disabled={busy}
          className="absolute top-4 right-4 text-ink-tertiary hover:text-ink"
        >
          <X size={18} />
        </button>

        {busy ? (
          <div className="py-12 text-center">
            <Loader2 className="animate-spin mx-auto text-terracotta mb-4" size={32} />
            <p className="font-editorial-italic text-xl">{busyMsg}</p>
            <p className="text-xs text-ink-tertiary mt-2">Claude is reading and organizing the recipe.</p>
          </div>
        ) : (
          <>
            <div className="mb-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-terracotta font-medium mb-1 flex items-center gap-1">
                <Sparkles size={11} /> Add a recipe
              </p>
              <h2 className="font-editorial-italic text-2xl mb-1">Where's it from?</h2>
              <p className="text-sm text-ink-muted">
                Claude will read it, structure it, and file it for you.
              </p>
            </div>

            {!source ? (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  <SourceButton icon={<Camera />} label="Camera" hint="Snap a single page" onClick={() => cameraInputRef.current?.click()} />
                  <SourceButton icon={<ImageIcon />} label="Photos" hint="Pick one or several" onClick={() => fileInputRef.current?.click()} />
                  <SourceButton icon={<FileText />} label="PDF" hint="Upload a document" onClick={() => fileInputRef.current?.click()} />
                  <SourceButton icon={<Link2 />} label="Web URL" hint="Any recipe site" onClick={() => setSource('url')} />
                </div>
                <p className="mt-3 text-[11px] text-ink-tertiary leading-relaxed text-center px-1">
                  💡 <span className="font-medium text-ink-muted">Multi-page recipe?</span> Take all the photos in your phone's regular Camera app first, then tap <span className="font-medium text-ink-muted">Photos</span> here to pick them all at once.
                </p>
              </>
            ) : source === 'url' ? (
              <div>
                <input
                  type="url"
                  placeholder="https://..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUrl()}
                  className="w-full px-4 py-2.5 rounded-lg border border-ink/15 mb-3 bg-cream-card focus:border-terracotta outline-none text-sm"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setSource(null)}
                    className="flex-1 py-2 rounded-lg border border-ink/20 text-sm hover:bg-ink/5"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleUrl}
                    disabled={!url.trim()}
                    className="flex-1 py-2 rounded-lg bg-ink text-cream text-sm font-medium disabled:opacity-50"
                  >
                    Import
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length) handleFiles(files, 'camera');
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (!files.length) return;
            // PDFs are single-file. Multiple images are batched.
            const isPdf = files[0].type === 'application/pdf';
            handleFiles(isPdf ? [files[0]] : files, isPdf ? 'pdf' : 'image');
          }}
        />

        {error && (
          <div className="mt-4 p-3 bg-terracotta/10 text-terracotta-dark text-sm rounded-lg">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function SourceButton({
  icon, label, hint, onClick,
}: { icon: React.ReactNode; label: string; hint: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="aspect-square rounded-xl border border-ink/15 hover:border-terracotta hover:bg-terracotta/5 flex flex-col items-center justify-center gap-1.5 transition group p-3"
    >
      <span className="text-terracotta">{icon}</span>
      <span className="font-medium text-sm">{label}</span>
      <span className="text-[10px] text-ink-tertiary leading-tight">{hint}</span>
    </button>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
