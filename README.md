# ResourceHub

A personal knowledge base for saving **resources** and **learning items**, organising them with a
category → subcategory → tag taxonomy, and finding them again with AI-powered search.

## Features

- **Resources & Learning**: rich-text descriptions (tables pasted from ChatGPT, Docs, etc. are kept), optional HTML content, favourites, and public share links
- **Taxonomy**: categories, subcategories and tags, with a drag-and-drop dashboard
- **Notes**: sticky notes
- **AI Assistant** (`/ai`):
  - **Ask**: questions answered **only from your own content**, with links to the source items
  - **Search**: semantic search (by meaning) plus exact title matches
  - **Duplicate items**: finds items that say almost the same thing
  - **Related content**: shown under every resource and learning item
- **Library Organizer** (`/ai/organize`, admins only): AI inspects categories, subcategories, tags and items and
  recommends merges, renames, moves, re-filing and tags. You review them, approve or reject them, apply them safely, and can undo them.

## Tech stack

React 18 + TypeScript + Vite + Tailwind · Supabase (Postgres, Auth, RLS, Edge Functions, pgvector) · Google Gemini · Vercel

## Getting started

```bash
npm install
cp .env.example .env   # fill in your Supabase URL and anon key
npm run dev
```

| Script            | What it does                         |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start the dev server                 |
| `npm run build`   | Type-check and build to `dist/`      |
| `npm run lint`    | ESLint                               |
| `npm test`        | Database + AI-workflow tests (Vitest, real Postgres via PGlite) |
| `npm run preview` | Serve the production build locally   |

### Database

Apply the SQL files in `supabase/migrations/` in filename order, using the Supabase CLI
(`supabase db push`) or the dashboard's SQL editor.

## AI features

The Gemini API key lives only on the server, in a Supabase Edge Function, and is never sent to the browser.
The function runs with the signed-in user's token, so row-level security keeps each user's content private.

| Piece                                              | Purpose                                                   |
| -------------------------------------------------- | --------------------------------------------------------- |
| `supabase/migrations/20261026_add_ai_embeddings.sql` | pgvector table + search / related / duplicate functions |
| `supabase/functions/ai/index.ts`                   | Indexing (embeddings), semantic search, grounded Q&A      |
| `src/lib/ai.ts`                                    | Client API                                                |

### Setup

1. **Database:** in the Supabase dashboard, open **SQL Editor** and run
   `supabase/migrations/20261026_add_ai_embeddings.sql`. It enables pgvector and creates `content_embeddings`
   and the search functions.
   > Avoid a bare `supabase db push` unless the CLI's migration history is up to date
   > (`npx supabase migration list`). Otherwise it re-runs every older migration.
2. **Secrets:** under **Edge Functions → Secrets**, set `GEMINI_API_KEY`. `GEMINI_MODEL`
   (default `gemini-3.1-flash-lite`) and `GEMINI_EMBEDDING_MODEL` (default `gemini-embedding-2`) are optional.
   You can also use `npx supabase secrets set GEMINI_API_KEY=your-key`.
3. **Deploy the function:** from the project root, in a terminal:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>   # the subdomain of VITE_SUPABASE_URL
npx supabase functions deploy ai
```

Then open **AI Assistant → Sync index** once to index your existing content. After that, items are re-indexed
automatically when you save them, and only items whose content changed are sent to Gemini.

### How it works

- Each item's title, skill level, category / subcategory / tag names, URL and text are embedded with `gemini-embedding-2`.
  The vectors are 768-dimensional and stored in `content_embeddings`.
- **Related content** and **duplicates** are pure database queries over those vectors, so they make no AI call per page view.
- **Ask** embeds the question, retrieves the closest items, and asks `gemini-3.1-flash-lite` to answer
  only from them. If nothing relevant is found, it says so instead of guessing.

## Library Organizer

An admin-only workflow that keeps the taxonomy consistent: it finds duplicate or overlapping categories
(e.g. "Azure" vs "Microsoft Azure Cloud"), inconsistent names, misfiled items and missing tags.

| Piece | Purpose |
| ----- | ------- |
| `supabase/migrations/20261027_add_taxonomy_inspector.sql` | Roles, inspection history, proposals, change detection, and the apply / rollback engine |
| `supabase/functions/taxonomy-inspector/` | Runs inspections with Gemini (background, chunked, resumable) |
| `supabase/functions/_shared/taxonomy.ts` | Prompts and validation of the model's output |
| `src/pages/LibraryOrganizer.tsx` | Admin review UI |

### Setup

Do the **AI features** setup first. Then:

1. In **SQL Editor**, run `supabase/migrations/20261027_add_taxonomy_inspector.sql`.
2. Make yourself an admin (also in SQL Editor):
   ```sql
   INSERT INTO user_roles (user_id, role)
   SELECT id, 'admin' FROM auth.users WHERE email = 'you@example.com';
   ```
3. Deploy the functions. `ai` is redeployed because it now shares code with the inspector:
   ```bash
   npx supabase functions deploy taxonomy-inspector
   npx supabase functions deploy ai
   ```
4. Open **Library Organizer** from the menu and run a **Full inspection**.

### How it works

- **The AI never touches data.** Gemini sees the taxonomy with short aliases (`C3`, `S7`, `T12`) and returns
  suggestions as structured JSON. The server validates every suggestion: it must reference real nodes, must not collide
  with existing names, must not leave an item uncategorised, and must not be something you already rejected. Valid
  suggestions are stored as typed proposals; invalid ones are counted and discarded.
- **Nothing changes until you apply.** Proposals are approved or rejected individually or in bulk. Applying runs a fixed
  database operation per proposal type in a transaction, in a safe order (new nodes → renames → moves → merges → item
  changes). It reuses existing same-name nodes instead of creating duplicates, keeps the items' legacy `tags` /
  `subcategories` arrays in sync, and records an undo log so each applied change can be **undone**.
  "All or nothing" applies a batch atomically.
- **Inspections are remembered.** Every run, its taxonomy snapshot, its proposals and their outcomes are stored.
  Each item's last-inspected hash covers its content *and* the names and placement of its taxonomy. An
  **incremental** inspection therefore looks only at new or changed items, plus items affected by a renamed or moved
  category, subcategory or tag. The structure is only re-analysed when it changed.
- **Long runs are safe.** Runs work in checkpointed chunks, retry transient AI errors, pause before the Edge Function
  time limit, and resume automatically, or via **Resume** after a failure, without redoing finished work.

## Deployment

Deployed on Vercel (`vercel.json` handles SPA rewrites, security headers and asset caching).
Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project settings.
