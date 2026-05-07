'use client';

import { useState, useEffect } from 'react';
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

export function MusicBar({ recipeCuisine }: { recipeCuisine?: string | null }) {
  const player = useSpotifyPlayer();
  const [expanded, setExpanded] = useState(false);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<any>(null);
  const [pickedFallback, setPickedFallback] = useState<any>(null);
  const [volume, setVolume] = useState(0.6);

  async function pickMood(moodId: string) {
    setPicking(true);
    setPicked(null);
    setPickedFallback(null);
    try {
      const res = await fetch('/api/spotify/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood: moodId, recipeCuisine }),
      });
      const data = await res.json();

      if (data.authed && player.state.ready && data.playlists?.[0]) {
        // Premium path: start full playback in browser
        const p = data.playlists[0];
        setPicked(p);
        await player.playPlaylist(p.id);
      } else {
        // Fallback: iframe embed (preview/YouTube)
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
    if (picked) player.togglePlay(); // pause Spotify
  }

  // PREMIUM PLAYER — full controls with current track display
  if (picked && player.state.authed && player.state.ready) {
    const t = player.state.currentTrack;
    return (
      <div className="bg-cream-card border border-ink/10 rounded-xl p-4">
        <div className="flex items-center gap-3">
          {t?.image && (
            <img src={t.image} alt="" className="w-14 h-14 rounded-md flex-none" />
          )}
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
          <button
            onClick={player.previous}
            className="w-9 h-9 rounded-full hover:bg-ink/5 flex items-center justify-center"
            aria-label="Previous"
          >
            <SkipBack size={14} />
          </button>
          <button
            onClick={player.togglePlay}
            className="w-10 h-10 rounded-full bg-terracotta text-cream flex items-center justify-center hover:bg-terracotta-dark"
            aria-label={t?.paused ? 'Play' : 'Pause'}
          >
            {t?.paused ? <Play size={16} className="ml-0.5" /> : <Pause size={16} />}
          </button>
          <button
            onClick={player.next}
            className="w-9 h-9 rounded-full hover:bg-ink/5 flex items-center justify-center"
            aria-label="Next"
          >
            <SkipForward size={14} />
          </button>
          <div className="ml-auto flex items-center gap-2 flex-1 max-w-[140px]">
            <Volume2 size={13} className="text-ink-tertiary" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setVolume(v);
                player.setVolume(v);
              }}
              className="flex-1"
            />
          </div>
        </div>
        {player.state.error && (
          <div className="mt-2 text-xs text-terracotta-dark">{player.state.error}</div>
        )}
      </div>
    );
  }

  // FALLBACK IFRAME — preview player or YouTube embed
  if (pickedFallback) {
    return (
      <div className="bg-cream-card border border-ink/10 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-ink/10">
          <div className="flex items-center gap-2 text-sm">
            <Music size={14} className="text-terracotta" />
            <span className="font-medium">{pickedFallback.name}</span>
            <span className="text-[10px] uppercase tracking-wider text-ink-tertiary">
              {pickedFallback.provider === 'youtube' ? 'YouTube' :
               pickedFallback.provider === 'spotify' ? 'Spotify · preview only' : 'Spotify'}
            </span>
          </div>
          <button onClick={clear} className="text-ink-tertiary hover:text-terracotta">
            <X size={14} />
          </button>
        </div>
        {pickedFallback.embedUrl && (
          <iframe
            src={pickedFallback.embedUrl}
            className="w-full"
            style={{ height: pickedFallback.provider?.startsWith('spotify') ? 80 : 200 }}
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        )}
      </div>
    );
  }

  // INITIAL PROMPT
  return (
    <div className="bg-gradient-to-r from-terracotta/8 via-cream-card to-cream-card border border-ink/10 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm min-w-0">
          <Music size={16} className="text-terracotta flex-none" />
          <div className="min-w-0">
            <div className="font-medium">Cooking music?</div>
            {player.state.loading ? (
              <div className="text-[11px] text-ink-tertiary">Connecting…</div>
            ) : player.state.authed ? (
              <div className="text-[11px] text-ink-tertiary truncate">
                Connected as {player.state.displayName || 'you'} · full playback
              </div>
            ) : (
              <div className="text-[11px] text-ink-tertiary">
                <a href="/api/spotify/auth/login" className="text-terracotta hover:underline">
                  Connect Spotify Premium
                </a> for full songs, or pick a mood for previews/YouTube
              </div>
            )}
          </div>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-ink-muted hover:text-ink flex-none"
        >
          {expanded ? 'Hide' : 'Pick a mood'}
        </button>
      </div>
      {expanded && (
        <div className="flex flex-wrap gap-1.5 mt-3">
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
      )}
      {player.state.error && (
        <div className="mt-2 text-xs text-terracotta-dark">{player.state.error}</div>
      )}
    </div>
  );
}
