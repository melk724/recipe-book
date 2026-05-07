import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessTokenForUser, requireUser } from '@/lib/spotify';

export type MusicSource = 'spotify' | 'youtube' | 'soundcloud';

const MOOD_MAP: Record<string, { query: string }> = {
  upbeat: { query: 'feel good cooking' },
  chill: { query: 'chill cooking' },
  jazzy: { query: 'kitchen jazz' },
  italian: { query: 'italian dinner' },
  dinner_party: { query: 'dinner party' },
  energetic: { query: 'high energy cooking' },
  focused: { query: 'focus cooking instrumental' },
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

function getYouTubePlaylist(query: string) {
  // YouTube doesn't require auth for embed search results
  const ytQuery = encodeURIComponent(`${query} playlist`);
  return [
    {
      provider: 'youtube',
      name: `${query} (YouTube)`,
      description: 'Full songs via YouTube — has occasional ads',
      embedUrl: `https://www.youtube.com/embed?listType=search&list=${ytQuery}`,
      externalUrl: `https://music.youtube.com/search?q=${ytQuery}`,
    },
  ];
}

async function getSoundCloudPlaylists(query: string) {
  // SoundCloud has a public search via their website that works in embeds.
  // We give them a search URL embedded in SoundCloud's player.
  // Note: SoundCloud's HTML-embed search URL pattern.
  const scQuery = encodeURIComponent(query);
  // Using their public search results page URL inside the player widget
  const searchUrl = `https://soundcloud.com/search/sounds?q=${scQuery}`;
  const widgetUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(searchUrl)}&color=%23B8543A&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=false`;
  return [
    {
      provider: 'soundcloud',
      name: `${query} (SoundCloud)`,
      description: 'Full tracks, no account needed',
      embedUrl: widgetUrl,
      externalUrl: `https://soundcloud.com/search/sounds?q=${scQuery}`,
    },
  ];
}

export async function POST(req: NextRequest) {
  try {
    const { mood, recipeCuisine, source } = await req.json();
    const moodKey = mood || moodFromCuisine(recipeCuisine);
    const config = MOOD_MAP[moodKey] || MOOD_MAP.chill;

    // Determine source: explicit > user preference > default
    let chosenSource: MusicSource = source;
    if (!chosenSource) {
      try {
        const user = await requireUser();
        const pref = user.user_metadata?.music_source as MusicSource | undefined;
        chosenSource = pref || 'youtube'; // YouTube is the safest default — works for everyone
      } catch {
        chosenSource = 'youtube';
      }
    }

    if (chosenSource === 'spotify') {
      // Try user's connected Spotify first (Premium = full playback)
      try {
        const user = await requireUser();
        const userToken = await getValidAccessTokenForUser(user.id);
        if (userToken) {
          const playlists = await getSpotifyPlaylists(config.query, userToken.accessToken);
          if (playlists.length) {
            return NextResponse.json({
              mood: moodKey,
              source: 'spotify',
              playlists,
              authed: true,
              displayName: userToken.displayName,
            });
          }
        }
      } catch {}

      // Fallback to client-credentials (preview only)
      try {
        const playlists = await getSpotifyPlaylists(config.query);
        if (playlists.length) {
          return NextResponse.json({ mood: moodKey, source: 'spotify', playlists, authed: false });
        }
      } catch {}

      // Spotify totally failed — fall through to YouTube
    }

    if (chosenSource === 'soundcloud') {
      const playlists = await getSoundCloudPlaylists(config.query);
      return NextResponse.json({ mood: moodKey, source: 'soundcloud', playlists, authed: false });
    }

    // Default / fallback: YouTube
    const playlists = getYouTubePlaylist(config.query);
    return NextResponse.json({ mood: moodKey, source: 'youtube', playlists, authed: false });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
