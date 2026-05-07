'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { uploadRecipePhoto, addNote, getRecipeNotes, getRecipePhotos } from '@/lib/notes-photos';
import { Star, Plus, Image as ImageIcon, X, Trash2 } from 'lucide-react';

export function RecipeNotesPhotos({
  recipe, steps, onChange,
}: { recipe: any; steps: any[]; onChange: () => void }) {
  const [notes, setNotes] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [showAddSession, setShowAddSession] = useState(false);
  const [showAddPinned, setShowAddPinned] = useState(false);
  const [addStepFor, setAddStepFor] = useState<number | null>(null);
  const galleryFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, [recipe.id]);

  async function load() {
    const [n, p] = await Promise.all([getRecipeNotes(recipe.id), getRecipePhotos(recipe.id)]);
    setNotes(n);
    // attach public URLs
    const withUrls = (p || []).map((ph: any) => ({
      ...ph,
      url: supabase.storage.from('recipe-images').getPublicUrl(ph.storage_path).data.publicUrl,
    }));
    setPhotos(withUrls);
  }

  const pinned = notes.filter((n) => n.note_type === 'pinned');
  const sessions = notes.filter((n) => n.note_type === 'session');
  const stepNotes = notes.filter((n) => n.note_type === 'step');
  const heroPhoto = photos.find((p) => p.photo_type === 'hero');

  async function handleGalleryUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const { data: { user } } = await supabase.auth.getUser();
    const isFirst = !heroPhoto;
    await uploadRecipePhoto({
      file,
      recipeId: recipe.id,
      userId: user!.id,
      photoType: isFirst ? 'hero' : 'session',
    });
    load();
    onChange();
  }

  async function setAsHero(photoId: string) {
    await supabase.from('recipe_photos').update({ photo_type: 'session' })
      .eq('recipe_id', recipe.id).eq('photo_type', 'hero');
    await supabase.from('recipe_photos').update({ photo_type: 'hero' }).eq('id', photoId);
    load();
    onChange();
  }

  async function deletePhoto(p: any) {
    if (!confirm('Delete this photo?')) return;
    await supabase.storage.from('recipe-images').remove([p.storage_path]);
    await supabase.from('recipe_photos').delete().eq('id', p.id);
    load();
    onChange();
  }

  async function deleteNote(id: string) {
    if (!confirm('Delete this note?')) return;
    await supabase.from('recipe_notes').delete().eq('id', id);
    load();
  }

  return (
    <div className="space-y-7">
      {/* PINNED */}
      <Section
        eyebrow="Pinned"
        title="Always remember"
        action={
          <button
            onClick={() => setShowAddPinned(true)}
            className="text-xs text-terracotta hover:text-terracotta-dark flex items-center gap-1"
          >
            <Plus size={14} /> Pin a note
          </button>
        }
      >
        {pinned.length === 0 && (
          <p className="text-sm text-ink-tertiary italic">
            Pin notes for things you always want to remember about this recipe — substitutions, family secrets, what to watch out for.
          </p>
        )}
        {pinned.map((n) => (
          <div
            key={n.id}
            className="bg-gold-soft border-l-2 border-gold rounded-r-md p-3 mb-2 text-sm italic font-editorial text-ink-soft relative group"
          >
            <span className="text-[10px] uppercase tracking-wider text-terracotta font-medium not-italic font-sans block mb-0.5">
              📌 Pinned
            </span>
            {n.content}
            <button
              onClick={() => deleteNote(n.id)}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-ink-tertiary hover:text-terracotta"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {showAddPinned && (
          <NoteForm
            placeholder="Mom always used buttermilk instead of milk…"
            onCancel={() => setShowAddPinned(false)}
            onSave={async (content) => {
              const { data: { user } } = await supabase.auth.getUser();
              await addNote({
                recipeId: recipe.id,
                userId: user!.id,
                noteType: 'pinned',
                content,
              });
              setShowAddPinned(false);
              load();
            }}
          />
        )}
      </Section>

      {/* COOK LOG */}
      <Section
        eyebrow="Cook log"
        title={`${sessions.length} ${sessions.length === 1 ? 'time' : 'times'} you've made this`}
        action={
          <button
            onClick={() => setShowAddSession(true)}
            className="text-xs text-terracotta hover:text-terracotta-dark flex items-center gap-1"
          >
            <Plus size={14} /> Log a session
          </button>
        }
      >
        {sessions.length === 0 && !showAddSession && (
          <p className="text-sm text-ink-tertiary italic">
            After cooking, log how it went — what worked, what to change, who loved it.
          </p>
        )}
        {sessions.map((n) => (
          <div key={n.id} className="bg-cream-card border border-ink/10 rounded-lg p-4 mb-2 group relative">
            <div className="text-[11px] uppercase tracking-wider text-ink-tertiary font-medium mb-1">
              {n.cooked_at ? new Date(n.cooked_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Recently'}
            </div>
            <p className="text-sm leading-relaxed">{n.content}</p>
            {n.rating && (
              <div className="flex gap-0.5 mt-1.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={12} fill={s <= n.rating ? '#D4A04C' : 'transparent'} stroke="#D4A04C" />
                ))}
              </div>
            )}
            <button
              onClick={() => deleteNote(n.id)}
              className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-ink-tertiary hover:text-terracotta"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {showAddSession && (
          <SessionNoteForm
            recipeId={recipe.id}
            onCancel={() => setShowAddSession(false)}
            onSaved={() => { setShowAddSession(false); load(); }}
          />
        )}
      </Section>

      {/* STEP TIPS */}
      <Section eyebrow="Step tips" title="Pinned to specific steps">
        {steps.length === 0 && <p className="text-sm text-ink-tertiary italic">No steps to annotate yet.</p>}
        <div className="space-y-2">
          {steps.map((s) => {
            const tip = stepNotes.find((sn) => sn.step_position === s.position);
            return (
              <div key={s.id} className="border border-ink/10 rounded-lg p-3">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-ink text-cream text-[11px] font-medium flex items-center justify-center flex-none">
                    {s.position + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm leading-relaxed">{s.instruction}</p>
                    {tip ? (
                      <div className="mt-2 bg-terracotta/5 border-l-2 border-terracotta rounded-r p-2.5 text-xs text-ink-soft relative group">
                        <span className="text-[10px] uppercase tracking-wider text-terracotta font-medium block mb-0.5">
                          Your tip
                        </span>
                        {tip.content}
                        <button
                          onClick={() => deleteNote(tip.id)}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-ink-tertiary hover:text-terracotta"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ) : addStepFor === s.position ? (
                      <NoteForm
                        compact
                        placeholder="Watch for the bottom catching here…"
                        onCancel={() => setAddStepFor(null)}
                        onSave={async (content) => {
                          const { data: { user } } = await supabase.auth.getUser();
                          await addNote({
                            recipeId: recipe.id,
                            userId: user!.id,
                            noteType: 'step',
                            stepPosition: s.position,
                            content,
                          });
                          setAddStepFor(null);
                          load();
                        }}
                      />
                    ) : (
                      <button
                        onClick={() => setAddStepFor(s.position)}
                        className="mt-2 text-[11px] text-ink-tertiary hover:text-terracotta flex items-center gap-1"
                      >
                        <Plus size={11} /> Add tip for this step
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* GALLERY */}
      <Section
        eyebrow="Gallery"
        title="Every time you've plated it"
        action={
          <button
            onClick={() => galleryFileRef.current?.click()}
            className="text-xs text-terracotta hover:text-terracotta-dark flex items-center gap-1"
          >
            <Plus size={14} /> Add photo
          </button>
        }
      >
        <input
          ref={galleryFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleGalleryUpload}
        />
        {photos.length === 0 ? (
          <button
            onClick={() => galleryFileRef.current?.click()}
            className="w-full aspect-[3/1] rounded-lg border border-dashed border-ink/25 flex flex-col items-center justify-center text-ink-tertiary hover:border-terracotta hover:text-terracotta"
          >
            <ImageIcon size={28} className="mb-2" />
            <span className="text-sm">Add a photo of your dish</span>
          </button>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {photos.map((p) => (
              <div key={p.id} className="aspect-square relative rounded-lg overflow-hidden border border-ink/10 group">
                <img src={p.url} alt="" className="w-full h-full object-cover" />
                {p.photo_type === 'hero' && (
                  <span className="absolute bottom-1.5 left-1.5 bg-ink/90 text-cream text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider">
                    Hero
                  </span>
                )}
                <div className="absolute inset-0 bg-ink/0 group-hover:bg-ink/40 transition flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  {p.photo_type !== 'hero' && (
                    <button
                      onClick={() => setAsHero(p.id)}
                      className="text-[10px] bg-cream text-ink px-2 py-1 rounded font-medium"
                    >
                      Set hero
                    </button>
                  )}
                  <button
                    onClick={() => deletePhoto(p)}
                    className="text-cream hover:text-gold"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={() => galleryFileRef.current?.click()}
              className="aspect-square rounded-lg border border-dashed border-ink/25 flex items-center justify-center text-ink-tertiary hover:border-terracotta hover:text-terracotta text-2xl"
            >
              +
            </button>
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({
  eyebrow, title, action, children,
}: { eyebrow: string; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-terracotta font-medium mb-0.5">{eyebrow}</p>
          <h2 className="font-editorial-italic text-xl">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function NoteForm({
  placeholder, onCancel, onSave, compact = false,
}: { placeholder: string; onCancel: () => void; onSave: (content: string) => void; compact?: boolean }) {
  const [text, setText] = useState('');
  return (
    <div className={`bg-cream-card border border-ink/15 rounded-lg p-3 ${compact ? 'mt-2' : ''}`}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent border-none outline-none text-sm resize-none min-h-[60px] placeholder:text-ink-tertiary"
        autoFocus
      />
      <div className="flex justify-end gap-2 mt-2">
        <button onClick={onCancel} className="text-xs text-ink-muted px-2 py-1">Cancel</button>
        <button
          onClick={() => text.trim() && onSave(text.trim())}
          disabled={!text.trim()}
          className="text-xs bg-ink text-cream px-3 py-1 rounded disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function SessionNoteForm({
  recipeId, onCancel, onSaved,
}: { recipeId: string; onCancel: () => void; onSaved: () => void }) {
  const [text, setText] = useState('');
  const [rating, setRating] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  async function save() {
    const { data: { user } } = await supabase.auth.getUser();
    await addNote({
      recipeId,
      userId: user!.id,
      noteType: 'session',
      content: text.trim(),
      rating: rating || undefined,
      cookedAt: date,
    });
    onSaved();
  }

  return (
    <div className="bg-cream-card border border-ink/15 rounded-lg p-4 mb-2">
      <div className="flex gap-3 items-center mb-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="text-xs bg-transparent border border-ink/15 rounded px-2 py-1"
        />
        <div className="flex gap-0.5 ml-auto">
          {[1, 2, 3, 4, 5].map((s) => (
            <button key={s} onClick={() => setRating(s === rating ? 0 : s)}>
              <Star
                size={16}
                fill={s <= rating ? '#D4A04C' : 'transparent'}
                stroke="#D4A04C"
                className="cursor-pointer"
              />
            </button>
          ))}
        </div>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="How did it go? What would you change?"
        className="w-full bg-transparent border-none outline-none text-sm resize-none min-h-[80px] placeholder:text-ink-tertiary"
        autoFocus
      />
      <div className="flex justify-end gap-2 mt-2">
        <button onClick={onCancel} className="text-xs text-ink-muted px-2 py-1">Cancel</button>
        <button
          onClick={save}
          disabled={!text.trim()}
          className="text-xs bg-ink text-cream px-3 py-1 rounded disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  );
}
