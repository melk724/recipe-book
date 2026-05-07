'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Mail, Lock, Loader2 } from 'lucide-react';

type Mode = 'signin' | 'signup';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const supabase = createClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    setError('');

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const params = new URLSearchParams(window.location.search);
        window.location.href = params.get('redirect') || '/';
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        // If email confirmation is OFF in Supabase settings, the user is signed in immediately.
        if (data.session) {
          window.location.href = '/';
        } else {
          setMessage(`Account created. Check your email to confirm — we sent a link to ${email}.`);
        }
      }
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-4">
            <div className="w-10 h-10 rounded-xl bg-terracotta flex items-center justify-center text-cream font-editorial-italic text-xl">
              b
            </div>
            <span className="font-editorial-italic text-2xl">Brian's Cookbook</span>
          </div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-terracotta font-medium mb-2">
            Welcome
          </p>
          <h1 className="font-editorial-italic text-3xl mb-2">
            {mode === 'signup' ? 'Make your cookbook' : 'Sign in to cook'}
          </h1>
          <p className="text-sm text-ink-muted">
            {mode === 'signin' && 'Welcome back to your collection.'}
            {mode === 'signup' && 'Your private recipes, scaled and shared on your terms.'}
          </p>
        </div>

        <div className="bg-cream-card border border-ink/10 rounded-2xl p-6">
          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-ink-soft block mb-1">Email</span>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-ink/15 bg-cream-card focus:border-terracotta outline-none text-sm"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-ink-soft block mb-1">Password</span>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Pick a password (6+ chars)' : 'Your password'}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-ink/15 bg-cream-card focus:border-terracotta outline-none text-sm"
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-lg bg-ink text-cream text-sm font-medium hover:bg-ink-soft disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              {mode === 'signin' && 'Sign in'}
              {mode === 'signup' && 'Create account'}
            </button>
          </form>

          {message && (
            <div className="mt-4 p-3 bg-sage/10 border border-sage/30 rounded-lg text-sm text-ink-soft">
              ✓ {message}
            </div>
          )}
          {error && (
            <div className="mt-4 p-3 bg-terracotta/10 border border-terracotta/30 rounded-lg text-sm text-terracotta-dark">
              {error}
            </div>
          )}

          <div className="mt-5 pt-5 border-t border-ink/10 text-center text-xs text-ink-tertiary">
            {mode === 'signin' ? (
              <>Don't have an account? <button onClick={() => setMode('signup')} className="text-terracotta hover:underline font-medium">Sign up</button></>
            ) : (
              <>Already have an account? <button onClick={() => setMode('signin')} className="text-terracotta hover:underline font-medium">Sign in</button></>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-ink-tertiary mt-6">
          Your recipes are private to your account.
        </p>
      </div>
    </div>
  );
}
