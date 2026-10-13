# DC Daily Checklist — Supabase edition

This standalone Next.js application runs locally or on a host that supports Next.js and Node.js 22 or later. PostgreSQL is hosted in your existing Supabase project:
https://scxvvvjlhewxjsezkyvk.supabase.co

## Start on Windows

Extract the ZIP first, then double-click `Start-Checklist.bat`. Node.js 22 or later must be installed. The first launch creates `.env.local` and opens it in Notepad if your publishable key is missing. Save your key, then double-click the launcher again. It installs dependencies when needed, selects an available local port, and opens the app in your default browser once ready. Keep the launcher window open; press Ctrl+C to stop. Your Supabase schema and approved login account still need the one-time setup below.

## Setup

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env.local`. Fill in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` using your project's publishable key. The project URL is already filled in. A legacy anon key is also compatible if your project has not adopted publishable keys. Never place a secret or service-role key in a `NEXT_PUBLIC_` variable.
3. In the Supabase SQL editor, inspect the existing schema and run `supabase/schema.sql` once. It creates two app-specific tables and Row Level Security policies. It intentionally fails instead of replacing a table if those names already exist.
4. Create or use an existing email/password account in Supabase Authentication. Approve that user by running the membership INSERT at the bottom of `supabase/schema.sql`, replacing the example email. A Supabase dashboard login is separate from an app Auth account. Only approved accounts can read or add checklist data. Membership cannot be edited from the app.
5. Run `npm run dev` and open http://localhost:3000. Sign in with the approved account.

## Production

Run `npm run build`, then `npm start`. On a Next.js host, configure the same two public environment variables before building. The project includes a lockfile and standard Node.js build configuration. For self-hosting, use HTTPS for external access. The app does not rely on ChatGPT Sites authentication or Cloudflare bindings.

## Existing records

The original Sites application remains unchanged and retains its existing data. Live data has not yet been transferred. Do not switch users away from the original application until a complete raw backup has been imported and verified, with writes paused during the final cutover.

The source database contains inspection, repair (`resolve`), and custom-question records. A complete backup must include all three kinds as raw rows with `id`, `created_at` (or `createdAt`), and the exact string `payload`. The normal inspections API alone is not a complete backup because it excludes custom questions.

Put the raw JSON backup outside this source folder or in ignored `backups/`. To validate it:

```sh
npm run import:records -- path/to/backup.json
```

To import, add a server-only `SUPABASE_SECRET_KEY` to `.env.local` and run:

```sh
npm run import:records -- path/to/backup.json --apply
```

The import preserves IDs, millisecond timestamps, inspector names, checklist snapshots, readings and remarks. It compares existing rows exactly, stops on conflicts, never updates/deletes existing records, and verifies every imported row. You can rerun it safely after an interruption. Remove the import secret from local configuration afterward. Normal app operation uses only the publishable key and signed-in users' sessions.

## Checks and retained features

Run `npm test`, `npm run typecheck`, and `npm run build`. All inspection validation, Riyadh dates, completion history, cooling charts, custom checklist questions, repairs, CSV exports, demo data, and PDF downloads are retained. PDF inspector names and filtered review exports use the same generator as the original app. Database reads paginate through all rows.

The app verifies sessions server-side with Supabase Auth and checks approved membership before database access. RLS independently restricts SELECT and INSERT to approved users. Public signup alone grants no checklist access. Normal clients cannot edit membership, update records, or delete history.

Live database creation, login, data import, and online deployment remain unverified until configuration and Supabase access are available.
