// A tiny stand-in for supabase-js's query builder that runs against PGlite as a given user (RLS applies).
// It covers the subset the Edge Functions use, so their real code can be tested against the real schema.
import type { Db } from './db';

type Result = { data: unknown; error: { message: string; code?: string } | null };

const ident = (s: string) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(s)) throw new Error(`bad identifier ${s}`);
  return `"${s}"`;
};
const ser = (v: unknown) => (v !== null && typeof v === 'object' && !(v instanceof Date) ? JSON.stringify(v) : v);

/** Parent table → FK column used by its junction tables. */
const PARENT_FK: Record<string, string> = { resources: 'resource_id', learning: 'learning_id' };

function splitTopLevel(s: string) {
  const out: string[] = [];
  let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

class Query implements PromiseLike<Result> {
  private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private cols = '*';
  private returning: string | null = null;
  private where: { sql: string; params: unknown[] }[] = [];
  private orders: string[] = [];
  private lim?: number;
  private one = false;
  private values: unknown;
  private conflict?: string;

  constructor(private db: Db, private user: string, private table: string) {}

  select(cols = '*') {
    if (this.op === 'select') this.cols = cols; else this.returning = cols;
    return this;
  }
  insert(v: unknown) { this.op = 'insert'; this.values = v; return this; }
  upsert(v: unknown, o?: { onConflict?: string }) { this.op = 'upsert'; this.values = v; this.conflict = o?.onConflict; return this; }
  update(v: unknown) { this.op = 'update'; this.values = v; return this; }
  delete() { this.op = 'delete'; return this; }

  private cond(col: string, op: string, value: unknown) {
    const c = ident(col);
    if (op === 'is') return { sql: value === null || value === 'null' ? `${c} IS NULL` : `${c} IS ${value === true || value === 'true' ? 'TRUE' : 'FALSE'}`, params: [] };
    const sqlOp = { eq: '=', neq: '<>', lt: '<', lte: '<=', gt: '>', gte: '>=', ilike: 'ILIKE' }[op];
    if (!sqlOp) throw new Error(`unsupported op ${op}`);
    return { sql: `${c} ${sqlOp} ?`, params: [value] };
  }
  eq(c: string, v: unknown) { this.where.push(this.cond(c, 'eq', v)); return this; }
  neq(c: string, v: unknown) { this.where.push(this.cond(c, 'neq', v)); return this; }
  lt(c: string, v: unknown) { this.where.push(this.cond(c, 'lt', v)); return this; }
  ilike(c: string, v: unknown) { this.where.push(this.cond(c, 'ilike', v)); return this; }
  is(c: string, v: unknown) { this.where.push(this.cond(c, 'is', v)); return this; }
  in(c: string, vs: unknown[]) {
    this.where.push(vs.length ? { sql: `${ident(c)} IN (${vs.map(() => '?').join(', ')})`, params: vs } : { sql: 'FALSE', params: [] });
    return this;
  }
  or(expr: string) {
    const parts = splitTopLevel(expr).map((p) => {
      const [col, op, ...rest] = p.split('.');
      return this.cond(col, op, rest.join('.'));
    });
    this.where.push({ sql: `(${parts.map((p) => p.sql).join(' OR ')})`, params: parts.flatMap((p) => p.params) });
    return this;
  }
  order(c: string, o?: { ascending?: boolean }) { this.orders.push(`${ident(c)} ${o?.ascending === false ? 'DESC' : 'ASC'}`); return this; }
  limit(n: number) { this.lim = n; return this; }
  single() { this.one = true; return this; }

  private selectList(cols: string) {
    return splitTopLevel(cols).map((part) => {
      const embed = part.match(/^(\w+)\((.*)\)$/);
      if (!embed) return part === '*' ? 't.*' : `t.${ident(part)}`;
      const [, child, inner] = embed;
      const fields = splitTopLevel(inner).map((f) => `'${f}', e.${ident(f)}`).join(', ');
      return `(SELECT coalesce(json_agg(json_build_object(${fields})), '[]') FROM ${ident(child)} e WHERE e.${ident(PARENT_FK[this.table])} = t.id) AS ${ident(child)}`;
    }).join(', ');
  }

  private build(): { sql: string; params: unknown[] } {
    const params: unknown[] = [];
    const whereSql = this.where.length ? ` WHERE ${this.where.map((w) => { params.push(...w.params); return w.sql; }).join(' AND ')}` : '';
    const t = ident(this.table);
    const ret = this.returning ? ` RETURNING ${this.returning === '*' ? '*' : splitTopLevel(this.returning).map(ident).join(', ')}` : '';

    if (this.op === 'select') {
      let sql = `SELECT ${this.selectList(this.cols)} FROM ${t} t${whereSql}`;
      if (this.orders.length) sql += ` ORDER BY ${this.orders.join(', ')}`;
      if (this.lim !== undefined) sql += ` LIMIT ${Number(this.lim)}`;
      return { sql, params };
    }
    if (this.op === 'update') {
      const entries = Object.entries(this.values as Record<string, unknown>);
      const sets = entries.map(([k]) => `${ident(k)} = ?`).join(', ');
      return { sql: `UPDATE ${t} SET ${sets}${whereSql}${ret}`, params: [...entries.map(([, v]) => ser(v)), ...params] };
    }
    if (this.op === 'delete') return { sql: `DELETE FROM ${t}${whereSql}${ret}`, params };

    const rows = (Array.isArray(this.values) ? this.values : [this.values]) as Record<string, unknown>[];
    const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const vals: unknown[] = [];
    const tuples = rows.map((r) => `(${keys.map((k) => (k in r ? (vals.push(ser(r[k])), '?') : 'DEFAULT')).join(', ')})`);
    let sql = `INSERT INTO ${t} (${keys.map(ident).join(', ')}) VALUES ${tuples.join(', ')}`;
    if (this.op === 'upsert') {
      const target = (this.conflict ?? 'id').split(',').map((c) => ident(c.trim()));
      sql += ` ON CONFLICT (${target.join(', ')}) DO UPDATE SET ${keys.map((k) => `${ident(k)} = EXCLUDED.${ident(k)}`).join(', ')}`;
    }
    return { sql: sql + ret, params: vals };
  }

  async exec(): Promise<Result> {
    try {
      const { sql, params } = this.build();
      let i = 0;
      const numbered = sql.replace(/\?/g, () => `$${++i}`);
      const rows = await this.db.as(this.user, numbered, params);
      if (this.op !== 'select' && !this.returning) return { data: null, error: null };
      if (this.one) {
        if (rows.length !== 1) return { data: null, error: { message: `expected 1 row, got ${rows.length}`, code: 'PGRST116' } };
        return { data: rows[0], error: null };
      }
      return { data: rows, error: null };
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } };
    }
  }

  then<A, B>(res?: ((v: Result) => A | PromiseLike<A>) | null, rej?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return this.exec().then(res, rej);
  }
}

export function testClient(db: Db, userId: string) {
  return {
    from: (table: string) => new Query(db, userId, table),
    rpc: async (fn: string, args: Record<string, unknown> = {}): Promise<Result> => {
      try {
        const meta = await db.admin<{ retset: boolean }>(`SELECT proretset AS retset FROM pg_proc WHERE proname = $1 AND pronamespace = 'public'::regnamespace`, [ident(fn).slice(1, -1)]);
        if (!meta.length) return { data: null, error: { message: `function ${fn} not found` } };
        const names = Object.keys(args);
        const call = `${ident(fn)}(${names.map((n, i) => `${ident(n)} => $${i + 1}`).join(', ')})`;
        const values = names.map((n) => ser(args[n]));
        if (meta[0].retset) return { data: await db.as(userId, `SELECT * FROM ${call}`, values), error: null };
        return { data: (await db.as<{ v: unknown }>(userId, `SELECT ${call} AS v`, values))[0].v, error: null };
      } catch (e) {
        return { data: null, error: { message: (e as Error).message } };
      }
    },
    auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
  };
}
