// MIDNIGHT VAULT — entrypoint the grader runs (Node 22, standard library
// only): copies game/ and screenshots/ into MAKEFUN_OUTPUT_DIR (default
// /output) and writes dossier.json there with make.fun's own dossier
// builder. Two runs over the same tree write byte-identical output, and a
// screenshot over 256 KiB is refused before anything is written.
import { cpSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const MAX_SCREENSHOT_BYTES = 262144;

const shotsDir = join(ROOT, 'screenshots');
const shots = readdirSync(shotsDir)
  .filter((name) => !name.startsWith('.'))
  .sort();
if (shots.length === 0) {
  throw new Error('screenshots/: no images — an entry needs at least one screenshot');
}
for (const name of shots) {
  const size = statSync(join(shotsDir, name)).size;
  if (size > MAX_SCREENSHOT_BYTES) {
    throw new Error(`screenshots/${name}: ${size} bytes, over the ${MAX_SCREENSHOT_BYTES} allowed`);
  }
}

// Clear only the CONTENTS of OUT, never OUT itself: on the grader the
// output directory is a mounted volume whose parent (/) is read-only, so
// removing OUT itself fails with EACCES (rmSync needs write on the parent).
// Emptying it in place only needs write on OUT, which the grader provides.
mkdirSync(OUT, { recursive: true });
for (const name of readdirSync(OUT)) {
  rmSync(join(OUT, name), { recursive: true, force: true });
}
cpSync(join(ROOT, 'game'), join(OUT, 'game'), { recursive: true });
cpSync(shotsDir, join(OUT, 'screenshots'), { recursive: true });

const dossier = buildDossier(OUT, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(OUT, 'dossier.json'), dossier);
console.log(`wrote ${join(OUT, 'dossier.json')} (${dossier.length} bytes, ${shots.length} screenshots)`);
