// Real Postgres (PGlite, WASM) with Supabase-style auth stubs, for testing migrations and SQL logic.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';

const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

// Migrations that define the taxonomy + AI schema, in order. (Earlier migrations target tables
// that were created outside the repo; their shapes are reproduced in BASE_SCHEMA.)
const MIGRATIONS = [
  '20240107_add_taxonomy_normalized.sql',
  '20240108_add_category_id_to_tags.sql',
  '20240109_update_tags_nullable_and_constraints.sql',
  '20240112_add_unconditional_unique_constraints_on_tags.sql',
  '20250919_update_tags_uniqueness_per_location.sql',
  '20261026_add_ai_embeddings.sql',
  '20261027_add_taxonomy_inspector.sql',
];

const BASE_SCHEMA = /* sql */ `
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE SCHEMA auth;
  CREATE SCHEMA extensions;
  CREATE TABLE auth.users (id UUID PRIMARY KEY, email TEXT);
  CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS
    $$ SELECT nullif(current_setting('request.jwt.claim.sub', TRUE), '')::UUID $$;
  GRANT USAGE ON SCHEMA auth, extensions TO authenticated, anon;
  GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;

  CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL, description TEXT DEFAULT '', color TEXT DEFAULT '#6366f1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now());
  CREATE TABLE resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL, description TEXT DEFAULT '', url TEXT DEFAULT '', html_content TEXT,
    tags TEXT[] DEFAULT '{}', subcategories TEXT[] DEFAULT '{}', is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
  CREATE TABLE learning (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL, description TEXT DEFAULT '', url TEXT DEFAULT '', html_content TEXT,
    tags TEXT[] DEFAULT '{}', subcategories TEXT[] DEFAULT '{}', difficulty_level TEXT DEFAULT 'Beginner',
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
  CREATE TABLE learning_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    learning_id UUID NOT NULL REFERENCES learning(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    UNIQUE (learning_id, category_id));
  CREATE TABLE resource_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    UNIQUE (resource_id, category_id));
  -- Legacy tags table (pre-taxonomy): global per-user names; later migrations add locations.
  CREATE TABLE tags (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES auth.users(id),
    name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT tags_user_id_name_key UNIQUE (user_id, name));

  ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
  ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
  ALTER TABLE learning ENABLE ROW LEVEL SECURITY;
  ALTER TABLE learning_categories ENABLE ROW LEVEL SECURITY;
  ALTER TABLE resource_categories ENABLE ROW LEVEL SECURITY;
  CREATE POLICY own ON categories FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  CREATE POLICY own ON resources FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  CREATE POLICY own ON learning FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  CREATE POLICY own ON learning_categories FOR ALL
    USING (EXISTS (SELECT 1 FROM learning l WHERE l.id = learning_id AND l.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM learning l WHERE l.id = learning_id AND l.user_id = auth.uid()));
  CREATE POLICY own ON resource_categories FOR ALL
    USING (EXISTS (SELECT 1 FROM resources r WHERE r.id = resource_id AND r.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM resources r WHERE r.id = resource_id AND r.user_id = auth.uid()));
`;

const GRANTS = /* sql */ `
  GRANT USAGE ON SCHEMA public TO authenticated, anon;
  GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
`;

export type Db = PGlite & {
  /** Run SQL as an authenticated user (RLS applies). */
  as: <T = Record<string, unknown>>(userId: string, sql: string, params?: unknown[]) => Promise<T[]>;
  /** Run SQL as the superuser (RLS bypassed), e.g. for fixtures. */
  admin: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;
};

export async function createDb(): Promise<Db> {
  const pg = await PGlite.create({ extensions: { vector } });
  await pg.exec(BASE_SCHEMA);
  for (const file of MIGRATIONS) {
    try {
      await pg.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
    } catch (e) {
      throw new Error(`Migration ${file} failed: ${(e as Error).message}`);
    }
  }
  await pg.exec(GRANTS);

  const db = pg as unknown as Db;
  db.as = async (userId, sql, params) => {
    await pg.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '${userId}', FALSE); SET ROLE authenticated;`);
    try {
      return (await pg.query(sql, params)).rows as never;
    } finally {
      await pg.exec('RESET ROLE;');
    }
  };
  db.admin = async (sql, params) => (await pg.query(sql, params)).rows as never;
  return db;
}
