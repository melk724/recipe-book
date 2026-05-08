import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessTokenForUser, requireUser } from '@/lib/spotify';

export type MusicSource = 'spotify' | 'youtube' | 'soundcloud';

const MOOD_QUERIES: Record<string, { search: string; soundcloud: string[] }> = {
  upbeat: {
    search: 'feel good cooking music playlist',
    // All SoundCloud URLs verified to exist
    soundcloud: [
      'https://soundcloud.com/sound-playlist/sets/complete-2025-top-trending',
      'https://soundcloud.com/sc-playlists/sets/lo-fi-chill-beats',
    ],
  },
  chill: {
    search: 'chill cooking lofi playlist',
    soundcloud: [
      'https://soundcloud.com/sc-playlists/sets/lo-fi-chill-beats',
      'https://soundcloud.com/chillhopdotcom/sets/lofihiphop',
    ],
  },
  jazzy: {
    search: 'jazz cooking dinner playlist',
    soundcloud: [
      'https://soundcloud.com/relaxmusicrecords/sets/coffee-shop-jazz-caf-music',
      'https://soundcloud.com/jazzhopcafe/sets/coffee-and-crates',
    ],
  },
  italian: {
    search: 'italian dinner music playlist',
    soundcloud: [
      'https://soundcloud.com/italianrestaurantmusicacademy/sets/o-sole-mio-italian-restaurant',
      'https://soundcloud.com/profimedia/sets/ristorante-italiano-the',
    ],
  },
  dinner_party: {
    search: 'dinner party background music playlist',
    soundcloud: [
      'https://soundcloud.com/smoothjazz24h/sets/bar-of-jazz-mellow-music-for',
      'https://soundcloud.com/relaxmusicrecords/sets/lounge-jazz-bar-cafe',
    ],
  },
  energetic: {
    search: 'high energy cooking music playlist',
    soundcloud: [
      'https://soundcloud.com/sound-playlist/sets/complete-2025-top-trending',
    ],
  },
  focused: {
    search: 'focus instrumental music playlist',
    soundcloud: [
      'https://soundcloud.com/chillhopdotcom/sets/lofihiphop',
      'https://soundcloud.com/dabootlegboy/sets/study-chill-lofi-hiphop',
    ],
  },
};

function moodFromCuisine(cuisine: string | null | undefined): string {
  if (!cuisine) return 'chill';
  const c = cuisine.toLowerCase();
  if (c.includes('italian')) return 'italian';
  if (c.includes('french')) return 'jazzy';
  if (c.includes('mexican') || c.includes('latin')) return 'upbeat';
  if (c.includes('asian') || c.includes('japanese') || c.includes('chinese') || c.includes('thai')) return 'focused';
  return 'chill';
}

// ===== Spotify =====
async function getSpotifyClientCredsToken() {
  const auth = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  return data.access_token;
}

async function getSpotifyPlaylists(query: string, userToken?: string) {
  const token = userToken || await getSpotifyClientCredsToken();
  const res = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=playlist&limit=8`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  return (data.playlists?.items || [])
    .filter((p: any) => p && p.id)
    .slice(0, 6)
    .map((p: any) => ({
      provider: userToken ? 'spotify-user' : 'spotify',
      id: p.id,
      uri: p.uri,
      name: p.name,
      description: p.description,
      image: p.images?.[0]?.url,
      embedUrl: `https://open.spotify.com/embed/playlist/${p.id}`,
      externalUrl: p.external_urls?.spotify,
    }));
}

// ===== YouTube via Data API v3 =====
async function getYouTubeResults(query: string) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    // Without an API key, fall back to a public playlist iframe that's known-stable.
    // YouTube no longer supports listType=search in embeds, so this is the only safe fallback.
    return [{
      provider: 'youtube',
      name: `${query}`,
      description: 'YouTube cooking music',
      embedUrl: `https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=0`, // Lofi Girl - Lofi Hip Hop Radio (very stable)
      externalUrl: `https://music.youtube.com/search?q=${encodeURIComponent(query)}`,
      note: 'Add YOUTUBE_API_KEY to env vars for proper search',
    }];
  }

  // Search for playlists first - they're better for sustained cooking music
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=playlist&maxResults=6&safeSearch=moderate&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    const errText = await res.text();
    console.error('YouTube API error:', res.status, errText);
    throw new Error(`YouTube search failed: ${res.status}`);
  }
  const data = await res.json();

  return (data.items || [])
    .filter((it: any) => it?.id?.playlistId)
    .map((it: any) => ({
      provider: 'youtube',
      id: it.id.playlistId,
      name: it.snippet.title,
      description: it.snippet.channelTitle,
      image: it.snippet.thumbnails?.medium?.url || it.snippet.thumbnails?.default?.url,
      embedUrl: `https://www.youtube.com/embed/videoseries?list=${it.id.playlistId}&autoplay=1`,
      externalUrl: `https://www.youtube.com/playlist?list=${it.id.playlistId}`,
    }));
}

// ===== SoundCloud (curated) =====
function getSoundCloudPlaylists(moodKey: string) {
  const urls = MOOD_QUERIES[moodKey]?.soundcloud || MOOD_QUERIES.chill.soundcloud;
  return urls.map((playlistUrl, i) => ({
    provider: 'soundcloud',
    id: `${moodKey}-${i}`,
    name: `${capitalize(moodKey.replace('_', ' '))} on SoundCloud`,
    description: 'Curated playlist',
    embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(playlistUrl)}&color=%23B8543A&auto_play=true&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=false`,
    externalUrl: playlistUrl,
  }));
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ===== Route handler =====
export async function POST(req: NextRequest) {
  try {
    const { mood, recipeCuisine, source } = await req.json();
    const moodKey = mood || moodFromCuisine(recipeCuisine);
    const config = MOOD_QUERIES[moodKey] || MOOD_QUERIES.chill;

    // Determine source: explicit > preference > YouTube
    let chosenSource: MusicSource = source;
    if (!chosenSource) {
      try {
        const user = await requireUser();
        const pref = user.user_metadata?.music_source as MusicSource | undefined;
        chosenSource = pref || 'youtube';
      } catch {
        chosenSource = 'youtube';
      }
    }

    if (chosenSource === 'spotify') {
      // Try authed Spotify (Premium) first
      try {
        const user = await requireUser();
        const userToken = await getValidAccessTokenForUser(user.id);
        if (userToken) {
          const playlists = await getSpotifyPlaylists(config.search, userToken.accessToken);
          if (playlists.length) {
            return NextResponse.json({
              mood: moodKey, source: 'spotify', playlists, authed: true,
              displayName: userToken.displayName,
            });
          }
        }
      } catch {}
      // Fall through to client-credentials Spotify (preview-only)
      try {
        const playlists = await getSpotifyPlaylists(config.search);
        if (playlists.length) {
          return NextResponse.json({ mood: moodKey, source: 'spotify', playlists, authed: false });
        }
      } catch {}
    }

    if (chosenSource === 'soundcloud') {
      const playlists = getSoundCloudPlaylists(moodKey);
      return NextResponse.json({ mood: moodKey, source: 'soundcloud', playlists, authed: false });
    }

    // YouTube path (and fallback when Spotify path fails)
    try {
      const playlists = await getYouTubeResults(config.search);
      return NextResponse.json({ mood: moodKey, source: 'youtube', playlists, authed: false });
    } catch (e: any) {
      return NextResponse.json({ error: e.message || 'YouTube search failed' }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
