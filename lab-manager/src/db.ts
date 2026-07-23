// Thin Postgres layer, parameterised SQL (no ORM). The ONLY place that talks to pg.
import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({
  host: config.pg.host,
  port: config.pg.port,
  user: config.pg.user,
  password: config.pg.password,
  database: config.pg.database,
  max: 10,
});

// Separate pool authenticated as the LOCKED-DOWN lab role. It has no privileges on
// any application table, so the deliberately-injectable SQLi lab query — the only
// place the platform runs concatenated SQL — cannot read or write anything beyond
// the per-session temp table it is handed. Connections are lazy: if the role isn't
// configured, this pool simply never connects.
export const labPool = new pg.Pool({
  host: config.pg.host,
  port: config.pg.port,
  user: config.pgLab.user,
  password: config.pgLab.password,
  database: config.pg.database,
  max: 5,
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as any[]);
}

export async function one<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const r = await query<T>(text, params);
  return r.rows[0] ?? null;
}
