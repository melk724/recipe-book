import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCodeForTokens, fetchSpotifyProfile, saveTokens, requireUser } from '@/lib/spotify';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL(`/?spotify=error&reason=${encodeURIComponent(error)}`, req.url));
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL('/?spotify=error&reason=missing_params', req.url));
  }

  const cookieStore = cookies();
  const expectedState = cookieStore.get('spotify_oauth_state')?.value;
  if (!expectedState || expectedState !== state) {
    return NextResponse.redirect(new URL('/?spotify=error&reason=state_mismatch', req.url));
  }

  try {
    const user = await requireUser();
    const tokens = await exchangeCodeForTokens(code);
    const profile = await fetchSpotifyProfile(tokens.access_token);

    if (profile.product !== 'premium') {
      return NextResponse.redirect(new URL('/?spotify=error&reason=not_premium', req.url));
    }

    await saveTokens({
      userId: user.id,
      spotifyUserId: profile.id,
      spotifyDisplayName: profile.display_name,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
    });

    cookieStore.delete('spotify_oauth_state');
    return NextResponse.redirect(new URL('/?spotify=connected', req.url));
  } catch (err: any) {
    console.error('Spotify callback failed:', err);
    return NextResponse.redirect(
      new URL(`/?spotify=error&reason=${encodeURIComponent(err.message || 'unknown')}`, req.url)
    );
  }
}
