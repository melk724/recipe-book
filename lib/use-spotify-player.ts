'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

declare global {
  interface Window {
    Spotify: any;
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

export interface SpotifyPlayerState {
  ready: boolean;
  deviceId: string | null;
  authed: boolean;
  displayName: string | null;
  loading: boolean;
  error: string | null;
  currentTrack: {
    name: string;
    artists: string;
    image: string | null;
    paused: boolean;
  } | null;
}

export function useSpotifyPlayer() {
  const playerRef = useRef<any>(null);
  const tokenRef = useRef<string | null>(null);
  const [state, setState] = useState<SpotifyPlayerState>({
    ready: false,
    deviceId: null,
    authed: false,
    displayName: null,
    loading: true,
    error: null,
    currentTrack: null,
  });

  // Fetch token from our API
  const fetchToken = useCallback(async (): Promise<string | null> => {
    const res = await fetch('/api/spotify/me');
    const data = await res.json();
    if (data.connected) {
      tokenRef.current = data.accessToken;
      setState((s) => ({ ...s, authed: true, displayName: data.displayName || null }));
      return data.accessToken;
    }
    setState((s) => ({ ...s, authed: false, loading: false }));
    return null;
  }, []);

  // Initialize SDK
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const token = await fetchToken();
      if (!token || cancelled) {
        setState((s) => ({ ...s, loading: false }));
        return;
      }

      // Inject SDK script if not already present
      if (!document.getElementById('spotify-sdk-script')) {
        const script = document.createElement('script');
        script.id = 'spotify-sdk-script';
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        script.async = true;
        document.body.appendChild(script);
      }

      const setup = () => {
        if (cancelled || !window.Spotify) return;

        const player = new window.Spotify.Player({
          name: "Brian's Cookbook",
          getOAuthToken: async (cb: (t: string) => void) => {
            const fresh = await fetchToken();
            cb(fresh || tokenRef.current || '');
          },
          volume: 0.6,
        });

        player.addListener('ready', ({ device_id }: any) => {
          if (cancelled) return;
          setState((s) => ({ ...s, ready: true, deviceId: device_id, loading: false }));
        });

        player.addListener('not_ready', () => {
          if (cancelled) return;
          setState((s) => ({ ...s, ready: false }));
        });

        player.addListener('initialization_error', ({ message }: any) => {
          if (cancelled) return;
          setState((s) => ({ ...s, error: message, loading: false }));
        });

        player.addListener('authentication_error', ({ message }: any) => {
          if (cancelled) return;
          setState((s) => ({ ...s, error: 'Authentication failed: ' + message, authed: false, loading: false }));
        });

        player.addListener('account_error', ({ message }: any) => {
          if (cancelled) return;
          setState((s) => ({
            ...s,
            error: 'Spotify Premium is required for in-app playback. ' + message,
            loading: false,
          }));
        });

        player.addListener('player_state_changed', (st: any) => {
          if (cancelled || !st) return;
          const track = st.track_window?.current_track;
          if (track) {
            setState((s) => ({
              ...s,
              currentTrack: {
                name: track.name,
                artists: track.artists?.map((a: any) => a.name).join(', ') || '',
                image: track.album?.images?.[0]?.url || null,
                paused: st.paused,
              },
            }));
          }
        });

        player.connect();
        playerRef.current = player;
      };

      if (window.Spotify) {
        setup();
      } else {
        window.onSpotifyWebPlaybackSDKReady = setup;
      }
    }

    init();
    return () => {
      cancelled = true;
      playerRef.current?.disconnect?.();
    };
  }, [fetchToken]);

  const playPlaylist = useCallback(async (playlistId: string) => {
    if (!state.deviceId || !tokenRef.current) return;
    try {
      const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${state.deviceId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${tokenRef.current}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ context_uri: `spotify:playlist:${playlistId}` }),
      });
      if (!res.ok && res.status !== 204) {
        const text = await res.text();
        throw new Error(text);
      }
    } catch (e: any) {
      setState((s) => ({ ...s, error: 'Could not start playback: ' + (e.message || 'unknown') }));
    }
  }, [state.deviceId]);

  const togglePlay = useCallback(() => playerRef.current?.togglePlay?.(), []);
  const next = useCallback(() => playerRef.current?.nextTrack?.(), []);
  const previous = useCallback(() => playerRef.current?.previousTrack?.(), []);
  const setVolume = useCallback((v: number) => playerRef.current?.setVolume?.(v), []);

  return { state, playPlaylist, togglePlay, next, previous, setVolume };
}
