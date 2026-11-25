import '../dashboard/engine.js';

export interface Protocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  watchlist: string[];
  protocols: Protocol[];
}
interface Factors {
  age_days: number | null;
  growth_pct: number;
  growth_multiplier: number;
  age_multiplier: number;
  category_multiplier: number;
  chain_multiplier: number;
  implied_value_usd: number;
}
const engine = (globalThis as unknown as { RadarEngine: {
  MODEL: object;
  isPreToken: (p: Protocol) => boolean;
  isEligible: (p: Protocol) => boolean;
  valueOf: (p: Protocol, asOf: string) => Factors;
  farmPlan: (p: Protocol, age: number | null) => { steps: string[]; chain: string; capital: number; gas: number; hold_days: number; route: string };
} }).RadarEngine;

export function parseSnapshot(raw: string): Snapshot {
  const s = JSON.parse(raw) as Snapshot;
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s.as_of) || !Number.isFinite(Date.parse(s.as_of)) || !Array.isArray(s.protocols) || !Array.isArray(s.watchlist) || !Number.isSafeInteger(s.floor_usd) || s.floor_usd <= 0) throw new Error('Invalid snapshot header');
  const slugs = new Set<string>();
  for (const p of s.protocols) {
    if (!p || typeof p.slug !== 'string' || !p.slug.length || p.slug.length > 128 || /\s/.test(p.slug) || slugs.has(p.slug) || typeof p.name !== 'string' || !p.name.trim() || !Array.isArray(p.chains) || p.chains.some(c => typeof c !== 'string') || !Number.isSafeInteger(p.tvl_usd) || p.tvl_usd < 0) throw new Error('Invalid snapshot protocol');
    for (const k of ['change_7d', 'mcap_usd'] as const) if (p[k] !== null && !Number.isFinite(p[k])) throw new Error(`Invalid ${k}: ${p.slug}`);
    for (const k of ['category', 'listed_at', 'gecko_id', 'symbol'] as const) if (p[k] !== null && typeof p[k] !== 'string') throw new Error(`Invalid ${k}: ${p.slug}`);
    slugs.add(p.slug);
  }
  if (s.watchlist.some(slug => !slugs.has(slug)) || new Set(s.watchlist).size !== s.watchlist.length) throw new Error('Invalid watchlist');
  return s;
}

export function buildRadar(snapshot: Snapshot) {
  const watch = new Set(snapshot.watchlist);
  const selected = snapshot.protocols.filter(p => watch.has(p.slug) || (engine.isEligible(p) && p.tvl_usd < snapshot.floor_usd));
  if (selected.some(p => !engine.isPreToken(p))) throw new Error('Watchlist has token evidence: cannot mix token records into the pre-token rank');
  const rows = selected.map(p => {
    const factors = engine.valueOf(p, snapshot.as_of);
    const farm = engine.farmPlan(p, factors.age_days);
    return { ...p, rank: 0, token_status: 'no-token-recorded', watchlist: watch.has(p.slug), ...factors, model: factors, farm: { ...farm, steps: undefined }, farm_steps: farm.steps };
  }).sort((a, b) => b.implied_value_usd - a.implied_value_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  rows.forEach((row, i) => { row.rank = i + 1; });
  if (rows.length < 100 || rows.length > 4000 || rows.every(r => r.implied_value_usd === rows[0].implied_value_usd)) throw new Error('Model produced an invalid board size or flat values');
  for (const row of rows) {
    if (!Number.isSafeInteger(row.implied_value_usd) || row.implied_value_usd < 1 || row.implied_value_usd > 100_000_000_000_000 || row.farm_steps.length < 3 || row.farm_steps.length > 12 || row.farm_steps.some(s => s.trim().length < 20 || s.trim().length > 600)) throw new Error(`Model failed row constraints: ${row.slug}`);
  }
  const live = snapshot.protocols.filter(p => !engine.isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  return { as_of: snapshot.as_of, source: snapshot.source, floor_usd: snapshot.floor_usd, universe_size: snapshot.protocols.length, watchlist: snapshot.watchlist, model: engine.MODEL, rows, live,
    omitted_size: snapshot.protocols.length - rows.length - live.length };
}
