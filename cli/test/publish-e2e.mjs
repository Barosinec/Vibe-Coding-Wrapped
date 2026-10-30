// End-to-end check: build the website, run it locally, run the real CLI binary against it and open
// the link it prints. Nothing is stored anywhere, so the site needs no database or files.
// Usage (from the repo root): node cli/test/publish-e2e.mjs
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeWrap } from '../src/link.js';
import { fixtureEnv, makeFixtureHome } from './fixtures.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BIN = join(ROOT, 'cli', 'bin', 'vibe-wrapped.js');
const NAME = 'E2E Tester';
const READY_MS = 120_000;
const step = (s) => process.stdout.write(`• ${s}\n`);
let server = null;

function freePort() {
  return new Promise((res, rej) => {
    const s = createServer();
    s.on('error', rej);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => res(port));
    });
  });
}

async function waitReady(url) {
  const deadline = Date.now() + READY_MS;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`site did not start within ${READY_MS / 1000}s`);
}

function stopServer() {
  if (!server || server.exitCode !== null) return;
  try {
    process.kill(-server.pid, 'SIGTERM'); // whole process group (npx -> next)
  } catch {
    // already gone
  }
}

const cli = (args, env) => spawnSync(process.execPath, [BIN, ...args], { env: { ...env, VIBE_WRAPPED_NO_OPEN: '1' }, encoding: 'utf8' });

async function main() {
  step('building the website');
  const build = spawnSync('npm', ['run', 'build', '-w', 'web'], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' } });
  assert.equal(build.status, 0, 'web build failed');

  const port = await freePort();
  const site = `http://localhost:${port}`;
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1', PUBLIC_URL: site };
  delete env.DATABASE_URL;
  delete env.POSTGRES_URL;
  delete env.VERCEL;
  server = spawn('npx', ['next', 'start', 'web', '-p', String(port)], { cwd: ROOT, env, detached: true, stdio: 'ignore' });
  await waitReady(site);
  step(`site up on ${site}`);

  const home = await makeFixtureHome();
  const before = readdirSync(home).sort();
  const cliEnv = { ...fixtureEnv(home), VIBE_WRAPPED_SITE: site };

  const dry = cli(['--dry-run', '--yes', '--name', NAME], cliEnv);
  assert.equal(dry.status, 0, dry.stderr);
  const run = cli(['--yes', '--name', NAME], cliEnv);
  assert.equal(run.status, 0, run.stderr);
  const link = run.stdout.trim().split('\n').pop();
  assert.ok(link.startsWith(`${site}/w/1`), `unexpected link ${link}`);
  assert.deepEqual(decodeWrap(link.slice(link.lastIndexOf('/') + 1)).value, JSON.parse(dry.stdout), 'link != --dry-run payload');
  assert.deepEqual(readdirSync(home).sort(), before, 'CLI wrote files into HOME');
  step(`CLI printed a ${link.length}-char link`);

  const page = await fetch(link);
  assert.equal(page.status, 200);
  assert.ok((await page.text()).includes(NAME), 'page does not show the display name');
  const card = await fetch(`${link}/opengraph-image`);
  assert.equal(card.headers.get('content-type'), 'image/png');
  const story = await fetch(`${link}/story`);
  assert.equal(story.status, 200);
  assert.match(story.headers.get('content-disposition') ?? '', /attachment/);
  step('wrap page, preview card and story image render from the link');

  assert.equal((await fetch(`${site}/w/1notawrap`)).status, 404);
  assert.equal((await fetch(`${link.slice(0, -20)}`)).status, 404);
  step('broken links give 404');

  process.stdout.write(`OK publish-e2e: link ${link.length} chars, rendered, previews, 404s, nothing stored\n`);
}

main()
  .catch((err) => {
    process.stderr.write(`FAIL publish-e2e: ${err?.stack ?? err}\n`);
    process.exitCode = 1;
  })
  .finally(stopServer);
