import { createClient as createSupabase, createAdminClient } from '@/lib/supabase-server';

export const SPOTIFY_SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-modify-playback-state',
  'user-read-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-top-read',
  'user-read-recently-played',
].join(' ');

export function getRedirectUri() {
  if (process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI) {
    return process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI;
  }
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return `${process.env.NEXT_PUBLIC_SITE_URL}/api/spotify/auth/callback`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/api/spotify/auth/callback`;
  }
  return 'http://127.0.0.1:3000/api/spotify/auth/callback';
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SPOTIFY_CLIENT_ID || '',
    scope: SPOTIFY_SCOPES,
    redirect_uri: getRedirectUri(),
    state,
    show_dialog: 'false',
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string) {
  const auth = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
    }),
  });
  if (!res.ok) throw new Error(`Spotify token exchange failed: ${await res.text()}`);
  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
  }>;
}

export async function refreshAccessToken(refreshToken: string) {
  const auth = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Spotify token refresh failed: ${await res.text()}`);
  return res.json() as Promise<{
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  }>;
}

export async function fetchSpotifyProfile(accessToken: string) {
  const res = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to fetch Spotify profile');
  return res.json();
}

/**
 * Get the currently authenticated app user. Throws if not signed in.
 */
export async function requireUser() {
  const supabase = createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user;
}

export async function saveTokens(opts: {
  userId: string;
  spotifyUserId: string;
  spotifyDisplayName?: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}) {
  const expiresAt = new Date(Date.now() + opts.expiresIn * 1000).toISOString();
  const admin = createAdminClient();
  const { error } = await admin.from('spotify_tokens').upsert({
    user_id: opts.userId,
    spotify_user_id: opts.spotifyUserId,
    spotify_display_name: opts.spotifyDisplayName,
    access_token: opts.accessToken,
    refresh_token: opts.refreshToken,
    expires_at: expiresAt,
  }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function getValidAccessTokenForUser(userId: string): Promise<{
  accessToken: string;
  displayName?: string;
} | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('spotify_tokens')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) return null;
  const expiresAt = new Date(data.expires_at).getTime();
  if (expiresAt - Date.now() < 60_000) {
    const refreshed = await refreshAccessToken(data.refresh_token);
    const expires = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await admin
      .from('spotify_tokens')
      .update({
        access_token: refreshed.access_token,
        expires_at: expires,
        ...(refreshed.refresh_token && { refresh_token: refreshed.refresh_token }),
      })
      .eq('user_id', userId);
    return { accessToken: refreshed.access_token, displayName: data.spotify_display_name };
  }
  return { accessToken: data.access_token, displayName: data.spotify_display_name };
}

export async function clearTokensForUser(userId: string) {
  const admin = createAdminClient();
  await admin.from('spotify_tokens').delete().eq('user_id', userId);
}
