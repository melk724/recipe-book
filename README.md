# 🍳 Brian's Cookbook

A personal recipe book that imports from photos, PDFs, camera, or URLs using Claude Vision. Auto-categorizes, scales by servings, generates smart shopping lists, and plays cooking music via Spotify or YouTube.

## What's inside

- **Next.js 14** (App Router) on TypeScript
- **Supabase** for database, auth, and image storage
- **Anthropic Claude** for vision-based recipe extraction
- **Spotify Web API** with **YouTube** fallback for cooking music
- **Tailwind CSS** + Fraunces serif for the editorial cookbook aesthetic

## Features

- Import from camera, photo, PDF, or web URL
- Auto-categorization (Mains, Sides, Desserts, etc.) and tag suggestions
- Scaling by servings with friendly fractions (½, ¾)
- Pinned notes, cook session logs with star ratings, step-level tips
- Photo gallery with hero photo selection
- Smart shopping list grouped by store section
- Cook mode with built-in step timers, screen-wake-lock, audible alerts
- Mood-based music recommendations (Italian, Jazzy, Upbeat, Chill, Dinner Party, etc.)
- Favorites with quick-access shelf

---

## Setup — step by step

### 1. Local install

```bash
unzip recipe-book.zip
cd recipe-book
npm install
```

### 2. Supabase (free tier)

1. Go to [supabase.com](https://supabase.com) → New Project. Pick any region close to you.
2. Wait ~1 minute for it to provision.
3. Open **SQL Editor** in the sidebar → **New Query** → paste the entire contents of `supabase/schema.sql` → **Run**. You should see "Success. No rows returned."
4. Open **Storage** in the sidebar → **New Bucket** → name it `recipe-images` → toggle **Public bucket** ON → Create.
5. Open **Project Settings** (gear icon) → **API** → copy:
   - `Project URL` → goes in `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → goes in `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3. Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com) → **API Keys** → Create Key.
2. Copy the `sk-ant-...` key → goes in `ANTHROPIC_API_KEY`.
3. Make sure the workspace has at least a few dollars of credit. Each recipe import costs roughly $0.01–0.03.

### 4. Spotify (optional but recommended)

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) → **Create app**.
2. Name: "Brian's Cookbook" · App description: anything · Redirect URI: `http://localhost:3000` (we don't actually use OAuth callback for v1 — just need any value).
3. Web API checkbox → Save.
4. Open the app → **Settings** → copy:
   - `Client ID` → `SPOTIFY_CLIENT_ID`
   - `Client secret` → `SPOTIFY_CLIENT_SECRET`

If you skip Spotify, the app gracefully falls back to YouTube Music search results — still works fine.

### 5. Create `.env.local`

In the project root, create a file called `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhb...
ANTHROPIC_API_KEY=sk-ant-...
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
```

### 6. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Click **+ Recipe** and try importing a photo of a recipe. 🎉

---

## Deploy to Vercel

### Option A — Vercel CLI (fastest)

```bash
npm i -g vercel
vercel
```

Follow the prompts. When asked about environment variables, paste the same values from your `.env.local`.

### Option B — Vercel Dashboard

1. Push the project to GitHub:
   ```bash
   git init
   git add .
   git commit -m "initial"
   git remote add origin git@github.com:briankrugle/recipe-book.git
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com) → **Add New** → **Project** → import your repo.
3. In the deployment configuration, add the same environment variables from `.env.local`.
4. Click **Deploy**.

Vercel will give you a URL like `recipe-book-briankrugle.vercel.app`. You can later connect a custom domain (`cookbook.briankrugle.com` for example) under Project Settings → Domains.

---

## Troubleshooting

**"Failed to extract recipe"** — check your `ANTHROPIC_API_KEY` is correct and your workspace has credit. Try a clearer photo.

**Images don't appear in the gallery** — make sure the Supabase storage bucket is named exactly `recipe-images` and is set to public.

**"Row level security policy violation"** — for now, the app works in single-user mode without auth. The RLS policies in the schema assume auth is set up. If you don't want auth yet, you can disable RLS on the recipes/notes/photos tables in the Supabase Table Editor (each table → top-right kebab menu → "Disable RLS"). Re-enable when you're ready to add multi-user support.

**Spotify isn't loading playlists** — check the Client ID/Secret are correct. The app will silently fall back to YouTube if Spotify fails.

---

## What's next

A few things deliberately left for v2:
- Multi-user auth (Supabase Auth UI) — currently single-user
- Editing extracted recipes after import
- Scheduling/meal-planning calendar view
- Auto-suggest favorite based on cook log ratings
- Spotify OAuth for full playback control (currently search-only)
# recipe-book
