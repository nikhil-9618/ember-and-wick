import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "./types-d1";
import { ensureDatabaseReady } from "./bootstrap";

let cachedDb: D1Database | null = null;

/**
 * Resolves the D1 binding. In `next dev` this is provided by
 * initOpenNextCloudflareForDev (see next.config.ts); on Workers it is env.DB.
 */
export async function getDb(): Promise<D1Database> {
  if (cachedDb) return cachedDb;
  const context = await getCloudflareContext({ async: true });
  const db = (context.env as { DB?: D1Database }).DB;
  if (!db) {
    throw new Error(
      "D1 binding 'DB' is unavailable. Run `npm run db:migrate:local` and start the app with `npm run dev` so the local D1 binding is injected.",
    );
  }
  await ensureDatabaseReady(db);
  cachedDb = db;
  return db;
}

export async function getEnv(): Promise<Record<string, string | undefined>> {
  const context = await getCloudflareContext({ async: true });
  return context.env as unknown as Record<string, string | undefined>;
}

export async function firstRow<T>(query: string, values: unknown[] = []): Promise<T | null> {
  const db = await getDb();
  return db.prepare(query).bind(...values).first<T>();
}

export async function allRows<T>(query: string, values: unknown[] = []): Promise<T[]> {
  const db = await getDb();
  const result = await db.prepare(query).bind(...values).all<T>();
  return result.results ?? [];
}

export async function run(query: string, values: unknown[] = []): Promise<number> {
  const db = await getDb();
  const result = await db.prepare(query).bind(...values).run();
  return result.meta.changes ?? 0;
}
