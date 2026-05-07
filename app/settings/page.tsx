'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { AppHeader } from '@/components/AppHeader';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, User, Music } from 'lucide-react';

type MusicSource = 'spotify' | 'youtube' | 'soundcloud' | 'ask_each_time' | 'none';

const MUSIC_OPTIONS: { id: MusicSource; label: string; sub: string }[] = [
  { id: 'youtube', label: 'YouTube', sub: 'Full songs, no login. Best for everyone.' },
  { id: 'spotify', label: 'Spotify', sub: 'Premium recommended for full in-app playback.' },
  { id: 'soundcloud', label: 'SoundCloud', sub: 'Full tracks, no account needed.' },
  { id: 'ask_each_time', label: 'Ask me each time', sub: 'Pick a service when you start cooking.' },
  { id: 'none', label: 'Hide the music bar', sub: 'I have my own music going.' },
];

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [displayName, setDisplayName] = useState('');
  const [musicSource, setMusicSource] = useState<MusicSource>('youtube');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setDisplayName(data.user?.user_metadata?.display_name || '');
      setMusicSource((data.user?.user_metadata?.music_source as MusicSource) || 'youtube');
    });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          display_name: displayName.trim() || null,
          music_source: musicSource,
        },
      });
      if (error) throw error;
      setMessage('Saved!');
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      setTimeout(() => setMessage(''), 3000);
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-cream">
        <AppHeader />
        <div className="max-w-2xl mx-auto p-6 text-ink-muted">Loading…</div>
      </div>
    );
  }

  const fallback = user.email?.split('@')[0] || 'You';
  const preview = displayName.trim() || fallback;

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader />
      <main className="max-w-xl mx-auto px-4 sm:px-6 py-6">
        <button
          onClick={() => router.push('/')}
          className="text-sm text-ink-muted hover:text-ink flex items-center gap-1 mb-4"
        >
          <ArrowLeft size={14} /> Back to cookbook
        </button>

        <p className="text-[11px] uppercase tracking-[0.18em] text-terracotta font-medium mb-2">
          Settings
        </p>
        <h1 className="font-editorial-italic text-3xl mb-6">Your account</h1>

        <form onSubmit={save} className="space-y-5">
          {/* Display name card */}
          <div className="bg-cream-card border border-ink/10 rounded-2xl p-6">
            <div className="mb-4">
              <h2 className="font-editorial-italic text-xl mb-1">Display name</h2>
              <p className="text-xs text-ink-muted">Shown at the top of your cookbook.</p>
            </div>
            <label className="block">
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={fallback}
                  maxLength={40}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-ink/15 bg-cream-card focus:border-terracotta outline-none text-sm"
                />
              </div>
              <p className="text-xs text-ink-tertiary mt-1.5">
                Preview: <span className="font-editorial-italic text-ink-muted">"{preview}'s Cookbook"</span>
              </p>
            </label>
          </div>

          {/* Music source card */}
          <div className="bg-cream-card border border-ink/10 rounded-2xl p-6">
            <div className="mb-4">
              <h2 className="font-editorial-italic text-xl mb-1 flex items-center gap-2">
                <Music size={18} className="text-terracotta" />
                Music while cooking
              </h2>
              <p className="text-xs text-ink-muted">Default service for the cook mode music bar.</p>
            </div>
            <div className="space-y-1.5">
              {MUSIC_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    musicSource === opt.id
                      ? 'border-terracotta bg-terracotta/5'
                      : 'border-ink/10 hover:border-ink/25'
                  }`}
                >
                  <input
                    type="radio"
                    name="music_source"
                    value={opt.id}
                    checked={musicSource === opt.id}
                    onChange={() => setMusicSource(opt.id)}
                    className="mt-0.5 w-4 h-4 accent-terracotta cursor-pointer flex-none"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-xs text-ink-muted">{opt.sub}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Email (read-only) */}
          <div className="bg-cream-card border border-ink/10 rounded-2xl p-6">
            <h2 className="font-editorial-italic text-xl mb-1">Email</h2>
            <p className="text-sm text-ink-muted">{user.email}</p>
            <p className="text-[11px] text-ink-tertiary mt-1">Email can't be changed here yet.</p>
          </div>

          {/* Save */}
          <div className="sticky bottom-4 sm:static">
            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 rounded-lg bg-ink text-cream text-sm font-medium hover:bg-ink-soft disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg sm:shadow-none"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              Save changes
            </button>
            {message && (
              <div className="mt-3 p-3 bg-sage/10 border border-sage/30 rounded-lg text-sm text-ink-soft text-center">
                ✓ {message}
              </div>
            )}
            {error && (
              <div className="mt-3 p-3 bg-terracotta/10 border border-terracotta/30 rounded-lg text-sm text-terracotta-dark">
                {error}
              </div>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}
