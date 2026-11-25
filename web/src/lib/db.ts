import type { D1Database, D1PreparedStatement, D1Result } from "./types-d1";
import { ensureDatabaseReady } from "./bootstrap";

/**
 * Database access for a SQLite-dialect store, on more than one host.
 *
 * Every query in this project is plain SQLite, so the same SQL runs on:
 *
 *   - Cloudflare Workers, through the D1 binding `env.DB` (production today);
 *   - Vercel / any Node host, through libSQL (Turso) over HTTPS;
 *   - `next dev`, through a local libSQL file so no extra service is needed.
 *
 * The shape of the D1 API is small (`prepare`, `bind`, `first`, `all`, `run`,
 * `batch`), so libSQL is adapted to it instead of rewriting every statement.
 * `batch` stays a single transaction, which the checkout and payment paths rely
 * on for atomicity.
 */

let cachedDb: D1Database | null = null;
let cachedEnv: Record<string, string | undefined> | null = null;

const LOCAL_DB_URL = "file:.data/ember-wick.db";

interface LibsqlConfig {
  url: string;
  authToken?: string;
}

/**
 * Remote libSQL when configured, the local file during development, and nothing
 * in a production Node deployment without a database (a clear error beats a
 * half-working store that loses orders).
 */
function libsqlConfig(): LibsqlConfig | null {
  const turso = (process.env.TURSO_DATABASE_URL ?? "").trim();
  if (turso) return { url: turso, authToken: (process.env.TURSO_AUTH_TOKEN ?? "").trim() || undefined };

  const generic = (process.env.DATABASE_URL ?? "").trim();
  if (/^(libsql|https?\+libsql|file):/i.test(generic)) {
    return { url: generic, authToken: (process.env.TURSO_AUTH_TOKEN ?? "").trim() || undefined };
  }

  if (process.env.NODE_ENV !== "production") return { url: LOCAL_DB_URL };
  return null;
}

/** True only inside the Workers runtime, where the D1 binding can exist. */
function onWorkers(): boolean {
  const agent = (globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent;
  return agent === "Cloudflare-Workers";
}

async function cloudflareBinding(): Promise<D1Database | null> {
  if (!onWorkers()) return null;
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const context = await getCloudflareContext({ async: true });
    return (context.env as { DB?: D1Database }).DB ?? null;
  } catch {
    return null;
  }
}

function d1Meta(result: { rowsAffected: number; lastInsertRowid?: bigint | number | null }) {
  return {
    changes: Number(result.rowsAffected ?? 0),
    last_row_id: result.lastInsertRowid === undefined || result.lastInsertRowid === null
      ? 0
      : Number(result.lastInsertRowid),
  };
}

/** libSQL accepts only these argument types; `undefined` becomes SQL NULL. */
type LibsqlValue = string | number | bigint | ArrayBuffer | Uint8Array | boolean | null;

function toArgs(values: unknown[]): LibsqlValue[] {
  return values.map((value) => (value === undefined ? null : (value as LibsqlValue)));
}

interface LibsqlResultSet {
  rows: unknown[];
  rowsAffected: number;
  lastInsertRowid?: bigint | number | null;
}

interface LibsqlClient {
  execute(statement: { sql: string; args: LibsqlValue[] }): Promise<LibsqlResultSet>;
  batch(statements: { sql: string; args: LibsqlValue[] }[], mode?: "write" | "read" | "deferred"): Promise<LibsqlResultSet[]>;
  close(): void;
}

class LibsqlStatement implements D1PreparedStatement {
  constructor(
    private readonly db: LibsqlDatabase,
    readonly sql: string,
    readonly values: unknown[] = [],
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    return new LibsqlStatement(this.db, this.sql, values);
  }

  private async execute(): Promise<LibsqlResultSet> {
    return this.db.client.execute({ sql: this.sql, args: toArgs(this.values) });
  }

  async first<T = Record<string, unknown>>(columnName?: string): Promise<T | null> {
    const result = await this.execute();
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return (columnName ? row[columnName] : row) as T;
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const result = await this.execute();
    return { results: result.rows as T[], success: true, meta: d1Meta(result) };
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    // RETURNING clauses (used for rate limits) surface rows in `results`.
    const result = await this.execute();
    return { results: result.rows as T[], success: true, meta: d1Meta(result) };
  }
}

class LibsqlDatabase implements D1Database {
  constructor(readonly client: LibsqlClient) {}

  prepare(query: string): D1PreparedStatement {
    return new LibsqlStatement(this, query);
  }

  /** One transaction, matching D1: every statement commits or none does. */
  async batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const prepared = statements as LibsqlStatement[];
    const results = await this.client.batch(
      prepared.map((statement) => ({ sql: statement.sql, args: toArgs(statement.values) })),
      "write",
    );
    return results.map((result) => ({
      results: result.rows as T[],
      success: true,
      meta: d1Meta(result),
    }));
  }

  async exec(query: string): Promise<{ count: number; duration: number }> {
    const started = Date.now();
    const statements = query
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);
    if (statements.length > 0) {
      await this.client.batch(statements.map((sql) => ({ sql, args: [] })), "write");
    }
    return { count: statements.length, duration: Date.now() - started };
  }
}

async function createLibsqlDatabase(config: LibsqlConfig): Promise<LibsqlDatabase> {
  if (config.url.startsWith("file:")) {
    // A local file needs its directory; a remote URL never reaches this branch.
    const directory = config.url.replace(/^file:/, "").split("/").slice(0, -1).join("/");
    if (directory) {
      const { mkdirSync } = await import("node:fs");
      mkdirSync(directory, { recursive: true });
    }
  }
  const { createClient } = await import("@libsql/client");
  const client = createClient({
    url: config.url,
    ...(config.authToken ? { authToken: config.authToken } : {}),
  }) as unknown as LibsqlClient;
  return new LibsqlDatabase(client);
}

/**
 * Resolves the database for this runtime: the Workers D1 binding when one exists,
 * otherwise libSQL (Turso in production, a local file in development).
 */
export async function getDb(): Promise<D1Database> {
  if (cachedDb) return cachedDb;

  const binding = await cloudflareBinding();
  let db: D1Database;
  if (binding) {
    db = binding;
  } else {
    const config = libsqlConfig();
    if (!config) {
      throw new Error(
        "No database is configured for this deployment. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN " +
          "(a free libSQL database), or deploy to Cloudflare where the D1 binding is provided.",
      );
    }
    db = await createLibsqlDatabase(config);
  }

  await ensureDatabaseReady(db);
  cachedDb = db;
  return db;
}

/** Environment variables, from the Workers binding when present, else process.env. */
export async function getEnv(): Promise<Record<string, string | undefined>> {
  if (cachedEnv) return cachedEnv;
  const base = { ...process.env } as Record<string, string | undefined>;
  if (!onWorkers()) {
    cachedEnv = base;
    return cachedEnv;
  }
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const context = await getCloudflareContext({ async: true });
    cachedEnv = { ...base, ...(context.env as Record<string, string | undefined>) };
  } catch {
    cachedEnv = base;
  }
  return cachedEnv;
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
