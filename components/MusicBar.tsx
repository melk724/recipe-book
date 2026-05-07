'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Music, X, Play, Pause, SkipForward, SkipBack, Volume2 } from 'lucide-react';
import { useSpotifyPlayer } from '@/lib/use-spotify-player';

const MOODS = [
  { id: 'italian', label: 'Italian' },
  { id: 'jazzy', label: 'Jazzy' },
  { id: 'upbeat', label: 'Upbeat' },
  { id: 'chill', label: 'Chill' },
  { id: 'dinner_party', label: 'Dinner party' },
  { id: 'focused', label: 'Focused' },
  { id: 'energetic', label: 'Energetic' },
];

type MusicSource = 'spotify' | 'youtube' | 'soundcloud';

const SOURCES: { id: MusicSource; label: string; emoji: string }[] = [
  { id: 'spotify', label: 'Spotify', emoji: '🎧' },
  { id: 'youtube', label: 'YouTube', emoji: '▶️' },
  { id: 'soundcloud', label: 'SoundCloud', emoji: '☁️' },
];

export function MusicBar({ recipeCuisine }: { recipeCuisine?: string | null }) {
  const player = useSpotifyPlayer();
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<any>(null);
  const [pickedFallback, setPickedFallback] = useState<any>(null);
  const [volume, setVolume] = useState(0.6);
  const [activeSource, setActiveSource] = useState<MusicSource>('youtube');
  const [hidden, setHidden] = useState(false);

  // Load preference and use it as the initial active source
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const pref = data.user?.user_metadata?.music_source as string | undefined;
      if (pref === 'none') {
        setHidden(true);
      } else if (pref === 'spotify' || pref === 'youtube' || pref === 'soundcloud') {
        setActiveSource(pref);
      }
      // 'ask_each_time' or unset → keep YouTube default (already set)
    });
  }, []);

  async function pickMood(moodId: string) {
    setPicking(true);
    setPicked(null);
    setPickedFallback(null);
    try {
      const res = await fetch('/api/music/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood: moodId, recipeCuisine, source: activeSource }),
      });
      const data = await res.json();

      if (data.authed && data.source === 'spotify' && player.state.ready && data.playlists?.[0]) {
        const p = data.playlists[0];
        setPicked(p);
        await player.playPlaylist(p.id);
      } else {
        setPickedFallback(data.playlists?.[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPicking(false);
    }
  }

  function clear() {
    setPicked(null);
    setPickedFallback(null);
    if (picked) player.togglePlay();
  }

  function changeSource(s: MusicSource) {
    setActiveSource(s);
    // Don't auto-clear current playback — user might just be browsing.
    // But do clear pending fallback iframes since they're tied to a specific source.
    setPickedFallback(null);
  }

  if (hidden) return null;

  // PREMIUM SPOTIFY PLAYER (full controls, after a Premium playlist starts)
  if (picked && player.state.authed && player.state.ready) {
    const t = player.state.currentTrack;
    return (
      <div className="bg-cream-card border border-ink/10 rounded-xl p-4">
        <div className="flex items-center gap-3">
          {t?.image && <img src={t.image} alt="" className="w-14 h-14 rounded-md flex-none" />}
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-terracotta font-medium mb-0.5">
              ▶ Spotify Premium · {picked.name}
            </div>
            <div className="font-medium text-sm truncate">{t?.name || 'Loading…'}</div>
            <div className="text-xs text-ink-muted truncate">{t?.artists}</div>
          </div>
          <button onClick={clear} className="text-ink-tertiary hover:text-terracotta">
            <X size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-ink/10">
          <button onClick={player.previous} className="w-9 h-9 rounded-full hover:bg-ink/5 flex items-center justify-center" aria-label="Previous">
            <SkipBack size={14} />
          </button>
          <button onClick={player.togglePlay} className="w-10 h-10 rounded-full bg-terracotta text-cream flex items-center justify-center hover:bg-terracotta-dark" aria-label={t?.paused ? 'Play' : 'Pause'}>
            {t?.paused ? <Play size={16} className="ml-0.5" /> : <Pause size={16} />}
          </button>
          <button onClick={player.next} className="w-9 h-9 rounded-full hover:bg-ink/5 flex items-center justify-center" aria-label="Next">
            <SkipForward size={14} />
          </button>
          <div className="ml-auto flex items-center gap-2 flex-1 max-w-[140px]">
            <Volume2 size={13} className="text-ink-tertiary" />
            <input
              type="range" min="0" max="1" step="0.05" value={volume}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setVolume(v);
                player.setVolume(v);
              }}
              className="flex-1"
            />
          </div>
        </div>
        {player.state.error && <div className="mt-2 text-xs text-terracotta-dark">{player.state.error}</div>}
      </div>
    );
  }

  // Embed iframe (YouTube / SoundCloud / Spotify-preview)
  const sourceTabs = (
    <div className="flex items-center gap-1 mb-3">
      <span className="text-[11px] uppercase tracking-wider text-ink-tertiary font-medium mr-2">Play via</span>
      {SOURCES.map((s) => (
        <button
          key={s.id}
          onClick={() => changeSource(s.id)}
          className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
            activeSource === s.id
              ? 'bg-ink text-cream border-ink'
              : 'bg-cream-card border-ink/15 text-ink-soft hover:border-terracotta'
          }`}
        >
          <span className="mr-1">{s.emoji}</span>{s.label}
        </button>
      ))}
    </div>
  );

  if (pickedFallback) {
    const provider = pickedFallback.provider as string;
    const isYT = provider === 'youtube';
    const isSC = provider === 'soundcloud';
    const isSP = provider.startsWith('spotify');
    return (
      <div className="bg-cream-card border border-ink/10 rounded-xl p-3">
        {sourceTabs}
        <div className="rounded-lg overflow-hidden border border-ink/10">
          <div className="flex items-center justify-between px-3 py-2 border-b border-ink/10 bg-cream">
            <div className="flex items-center gap-2 text-sm min-w-0">
              <Music size={13} className="text-terracotta flex-none" />
              <span className="font-medium truncate text-xs">{pickedFallback.name}</span>
              <span className="text-[10px] uppercase tracking-wider text-ink-tertiary flex-none">
                {isYT ? 'YouTube' : isSC ? 'SoundCloud' : isSP ? 'Spotify · preview' : provider}
              </span>
            </div>
            <button onClick={clear} className="text-ink-tertiary hover:text-terracotta flex-none">
              <X size={13} />
            </button>
          </div>
          {pickedFallback.embedUrl && (
            <iframe
              src={pickedFallback.embedUrl}
              className="w-full block"
              style={{ height: isYT ? 200 : isSC ? 180 : 80 }}
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          )}
        </div>
      </div>
    );
  }

  // Initial state — source picker + mood chips
  return (
    <div className="bg-gradient-to-r from-terracotta/8 via-cream-card to-cream-card border border-ink/10 rounded-xl p-4">
      {sourceTabs}

      {/* Source-specific status line */}
      {activeSource === 'spotify' && (
        <div className="text-[11px] text-ink-tertiary mb-2">
          {player.state.loading ? 'Connecting…'
            : player.state.authed
              ? <>✓ Premium connected as {player.state.displayName || 'you'} — full songs in-app</>
              : <><a href="/api/spotify/auth/login" className="text-terracotta hover:underline font-medium">Connect Premium</a> for full songs, or pick a mood for previews</>}
        </div>
      )}
      {activeSource === 'youtube' && (
        <div className="text-[11px] text-ink-tertiary mb-2">
          Full songs · no login needed · has occasional ads
        </div>
      )}
      {activeSource === 'soundcloud' && (
        <div className="text-[11px] text-ink-tertiary mb-2">
          Full tracks · no account needed
        </div>
      )}

      {/* Mood chips */}
      <div className="flex flex-wrap gap-1.5">
        {MOODS.map((m) => (
          <button
            key={m.id}
            onClick={() => pickMood(m.id)}
            disabled={picking}
            className="text-[11px] px-2.5 py-1 rounded-full border border-ink/15 bg-cream-card hover:bg-terracotta hover:text-cream hover:border-terracotta disabled:opacity-50 transition"
          >
            {picking ? '…' : m.label}
          </button>
        ))}
      </div>

      <div className="mt-2 pt-2 border-t border-ink/5 text-right">
        <a href="/settings" className="text-[10px] text-ink-tertiary hover:text-terracotta">Set default service →</a>
      </div>

      {player.state.error && activeSource === 'spotify' && (
        <div className="mt-2 text-xs text-terracotta-dark">{player.state.error}</div>
      )}
    </div>
  );
}
