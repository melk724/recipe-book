import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessTokenForUser, requireUser } from '@/lib/spotify';

const MOOD_MAP: Record<string, { genres: string[]; query: string; seedGenres: string[] }> = {
  upbeat: { genres: ['pop', 'funk', 'disco'], query: 'feel good cooking', seedGenres: ['pop', 'funk'] },
  chill: { genres: ['acoustic', 'chill', 'indie'], query: 'chill cooking', seedGenres: ['chill', 'acoustic'] },
  jazzy: { genres: ['jazz', 'bossa-nova', 'soul'], query: 'kitchen jazz', seedGenres: ['jazz', 'soul'] },
  italian: { genres: ['italian', 'classical'], query: 'italian dinner', seedGenres: ['classical', 'jazz'] },
  dinner_party: { genres: ['lounge', 'jazz', 'soul'], query: 'dinner party', seedGenres: ['jazz', 'soul'] },
  energetic: { genres: ['electronic', 'house', 'pop'], query: 'high energy cooking', seedGenres: ['electronic', 'house'] },
  focused: { genres: ['ambient', 'classical', 'instrumental'], query: 'focus cooking', seedGenres: ['ambient', 'classical'] },
};

async function getClientCredsToken() {
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

export async function POST(req: NextRequest) {
  try {
    const { mood, recipeCuisine } = await req.json();

    let moodKey = mood || 'chill';
    if (!mood && recipeCuisine) {
      const c = recipeCuisine.toLowerCase();
      if (c.includes('italian')) moodKey = 'italian';
      else if (c.includes('french')) moodKey = 'jazzy';
      else if (c.includes('mexican') || c.includes('latin')) moodKey = 'upbeat';
      else moodKey = 'chill';
    }
    const config = MOOD_MAP[moodKey] || MOOD_MAP.chill;

    // Try this user's connected Spotify account first (Premium = full playback)
    try {
      const user = await requireUser();
      const userToken = await getValidAccessTokenForUser(user.id);
      if (userToken) {
        const searchRes = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(config.query)}&type=playlist&limit=10`,
          { headers: { Authorization: `Bearer ${userToken.accessToken}` } }
        );
        const searchData = await searchRes.json();
        const playlists = (searchData.playlists?.items || [])
          .filter((p: any) => p && p.id)
          .slice(0, 6)
          .map((p: any) => ({
            provider: 'spotify-user',
            id: p.id,
            uri: p.uri,
            name: p.name,
            description: p.description,
            image: p.images?.[0]?.url,
            embedUrl: `https://open.spotify.com/embed/playlist/${p.id}`,
            externalUrl: p.external_urls?.spotify,
          }));
        if (playlists.length) {
          return NextResponse.json({
            mood: moodKey,
            playlists,
            authed: true,
            displayName: userToken.displayName,
          });
        }
      }
    } catch (e) {
      console.warn('User Spotify path failed, falling back:', e);
    }

    // Fallback: client credentials (preview-only)
    if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
      try {
        const token = await getClientCredsToken();
        const searchRes = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(config.query)}&type=playlist&limit=5`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const searchData = await searchRes.json();
        const playlists = (searchData.playlists?.items || [])
          .filter((p: any) => p && p.id)
          .map((p: any) => ({
            provider: 'spotify',
            id: p.id,
            name: p.name,
            description: p.description,
            image: p.images?.[0]?.url,
            embedUrl: `https://open.spotify.com/embed/playlist/${p.id}`,
            externalUrl: p.external_urls?.spotify,
          }));
        if (playlists.length) {
          return NextResponse.json({ mood: moodKey, playlists, authed: false });
        }
      } catch (e) {
        console.warn('Client creds fallback failed:', e);
      }
    }

    // Final fallback: YouTube
    const ytQuery = encodeURIComponent(`${config.query} playlist`);
    return NextResponse.json({
      mood: moodKey,
      authed: false,
      playlists: [
        {
          provider: 'youtube',
          name: `${moodKey.replace('_', ' ')} cooking music`,
          description: 'YouTube Music search results',
          embedUrl: `https://www.youtube.com/embed?listType=search&list=${ytQuery}`,
          externalUrl: `https://music.youtube.com/search?q=${ytQuery}`,
        },
      ],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
