import { NextRequest, NextResponse } from 'next/server';

// Mood-to-Spotify-genre mapping for cooking
const MOOD_MAP: Record<string, { genres: string[]; query: string }> = {
  upbeat: {
    genres: ['pop', 'funk', 'disco'],
    query: 'feel good cooking',
  },
  chill: {
    genres: ['acoustic', 'chill', 'indie'],
    query: 'chill cooking',
  },
  jazzy: {
    genres: ['jazz', 'bossa-nova', 'soul'],
    query: 'kitchen jazz',
  },
  italian: {
    genres: ['italian', 'classical'],
    query: 'italian dinner',
  },
  dinner_party: {
    genres: ['lounge', 'jazz', 'soul'],
    query: 'dinner party',
  },
  energetic: {
    genres: ['electronic', 'house', 'pop'],
    query: 'high energy cooking',
  },
  focused: {
    genres: ['ambient', 'classical', 'instrumental'],
    query: 'focus cooking',
  },
};

async function getSpotifyToken() {
  const auth = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  return data.access_token;
}

export async function POST(req: NextRequest) {
  try {
    const { mood, recipeCuisine } = await req.json();

    // Pick mood from cuisine if not provided
    let moodKey = mood || 'chill';
    if (!mood && recipeCuisine) {
      const c = recipeCuisine.toLowerCase();
      if (c.includes('italian')) moodKey = 'italian';
      else if (c.includes('french')) moodKey = 'jazzy';
      else if (c.includes('mexican') || c.includes('latin')) moodKey = 'upbeat';
      else moodKey = 'chill';
    }

    const config = MOOD_MAP[moodKey] || MOOD_MAP.chill;

    // Try Spotify first
    if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
      try {
        const token = await getSpotifyToken();
        const searchRes = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(config.query)}&type=playlist&limit=5`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const searchData = await searchRes.json();
        const playlists = searchData.playlists?.items
          ?.filter((p: any) => p && p.id)
          .map((p: any) => ({
            provider: 'spotify',
            name: p.name,
            description: p.description,
            image: p.images?.[0]?.url,
            embedUrl: `https://open.spotify.com/embed/playlist/${p.id}`,
            externalUrl: p.external_urls?.spotify,
          }));

        if (playlists?.length) {
          return NextResponse.json({ mood: moodKey, playlists });
        }
      } catch (e) {
        console.warn('Spotify failed, falling back to YouTube:', e);
      }
    }

    // YouTube Music fallback - search results page (always works, no auth)
    const ytQuery = encodeURIComponent(`${config.query} playlist`);
    return NextResponse.json({
      mood: moodKey,
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
