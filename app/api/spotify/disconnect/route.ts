import { NextResponse } from 'next/server';
import { clearTokensForUser, requireUser } from '@/lib/spotify';

export async function POST() {
  try {
    const user = await requireUser();
    await clearTokensForUser(user.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
}
