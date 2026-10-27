import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Edge Functions import supabase-js from JSR; tests swap in a PGlite-backed client.
      'jsr:@supabase/supabase-js@2': fileURLToPath(new URL('./supabase/tests/stubs/supabase-js.ts', import.meta.url)),
    },
  },
  test: {
    include: ['supabase/tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
