// Node 22.18+; type stripping only, builtins and local files. No network or wall clock.
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRadar, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

function option(name: string, fallback: string): string {
  const equal = process.argv.find(a => a.startsWith(`--${name}=`));
  if (equal) return equal.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) {
    const value = process.argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`--${name} needs a path`);
    return value;
  }
  return fallback;
}

const root = fileURLToPath(new URL('.', import.meta.url));
const input = option('input', process.env.MAKEFUN_INPUT_DIR ?? '/input');
const output = resolve(option('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output'));
const snapshot = parseSnapshot(readFileSync(input.endsWith('.json') ? input : join(input, 'snapshot.json'), 'utf8'));
const radar = buildRadar(snapshot);

mkdirSync(output, { recursive: true });
writeFileSync(join(output, 'board.json'), JSON.stringify({ rows: radar.rows }) + '\n');
// Classic scripts work from file:// as well as a local web server; no fetch needed.
writeFileSync(join(output, 'data.js'), 'globalThis.RADAR_DATA = ' + JSON.stringify(radar).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029') + ';\n');
for (const folder of ['dashboard', 'screenshots']) cpSync(join(root, folder), join(output, folder), { recursive: true });
writeFileSync(join(output, 'dossier.json'), buildDossier(output, {
  text_max_bytes: 65_536,
  screenshots: { max: 4, max_bytes: 524_288 },
  dashboard: { max_files: 400, max_bytes: 4_194_304 },
}));
process.stdout.write(`Signal Atlas: ${radar.rows.length} ranked records; ${radar.watchlist.length}/${snapshot.watchlist.length} watchlist; ${radar.live.length} token records separate. Output: ${output}\n`);
