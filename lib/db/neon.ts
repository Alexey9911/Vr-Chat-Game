import { neon } from '@neondatabase/serverless';

/**
 * Neon Postgres client (server-side only — used from Next.js API routes). The connection string lives in
 * `DATABASE_URL` (NEVER a `NEXT_PUBLIC_` var — it must not reach the browser). Lazy so a missing env at build
 * time doesn't crash the import; the route handler surfaces a clear error instead.
 */
export function getSql(): ReturnType<typeof neon> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }

  return neon(url);
}
