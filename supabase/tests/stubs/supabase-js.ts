// Test replacement for `jsr:@supabase/supabase-js@2`: hands the Edge Function a PGlite-backed client
// for whichever user the request's bearer token names.
export type SupabaseClient = ReturnType<typeof globalThis.__clientFor>;

declare global {
  // eslint-disable-next-line no-var
  var __clientFor: (authorization: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export function createClient(_url: string, _key: string, opts: { global: { headers: { Authorization: string } } }) {
  return globalThis.__clientFor(opts.global.headers.Authorization);
}
