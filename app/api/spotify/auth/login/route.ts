import { NextResponse } from 'next/server';
import { buildAuthUrl } from '@/lib/spotify';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function GET() {
  // Generate a random state value to prevent CSRF
  const state = crypto.randomBytes(16).toString('hex');

  const cookieStore = cookies();
  cookieStore.set('spotify_oauth_state', state, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
  });

  return NextResponse.redirect(buildAuthUrl(state));
}
