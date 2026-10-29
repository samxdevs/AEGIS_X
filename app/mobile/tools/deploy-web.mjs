/**
 * Builds the web version of the app and deploys it to Vercel
 * (https://sih-aegis-mobile.vercel.app).
 *
 * Expo puts package assets (fonts, expo-sqlite's .wasm) under
 * dist/assets/node_modules/, and the Vercel CLI never uploads a folder named
 * node_modules. Those files would 404 and the database would never open, so
 * the folder is renamed and every bundle's reference to it rewritten.
 *
 * The Vercel project link lives in mobile/.vercel and is copied into dist,
 * because `expo export` empties dist on every build.
 */

import { execSync } from 'node:child_process';
import { cpSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const dist = join(root, 'dist');
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });

run('npx expo export -p web');

renameSync(join(dist, 'assets/node_modules'), join(dist, 'assets/pkg'));
const js = join(dist, '_expo/static/js/web');
for (const f of readdirSync(js).filter((f) => f.endsWith('.js'))) {
  const p = join(js, f);
  writeFileSync(p, readFileSync(p, 'utf8').replaceAll('/assets/node_modules/', '/assets/pkg/'));
}

cpSync(join(root, '.vercel'), join(dist, '.vercel'), { recursive: true });
run('vercel deploy --cwd dist --prod --yes');
