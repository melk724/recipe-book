import { NextResponse } from 'next/server';
import { getValidAccessTokenForUser, requireUser } from '@/lib/spotify';

export async function GET() {
  try {
    const user = await requireUser();
    const tokens = await getValidAccessTokenForUser(user.id);
    if (!tokens) {
      return NextResponse.json({ connected: false });
    }
    return NextResponse.json({
      connected: true,
      accessToken: tokens.accessToken,
      displayName: tokens.displayName,
    });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
