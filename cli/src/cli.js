import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { collectSessions } from './parsers/index.js';
import { publishWrap } from './publish.js';
import { validateWrap } from './schema.js';
import { VERSION, computeWrap, resolveRange } from './stats.js';
import { renderSummary } from './summary.js';
import { localDate } from './util.js';

export const HELP = `vibe-wrapped ${VERSION}: Spotify Wrapped for your AI coding sessions

Reads Claude Code, Codex and Cursor history on this machine, computes your stats locally,
and turns them into a shareable link. Nothing is uploaded or stored: the stats travel inside
the link. Prompts and code never leave your machine.

Usage
  npx @vibewrap/vibe-wrapped [options]

Options
  --range <year|all|custom>  Time range (default: this calendar year; asked interactively)
  --since <YYYY-MM-DD>       Start of a custom range (implies --range custom)
  --until <YYYY-MM-DD>       End of a custom range (default: today)
  --name <text>              Display name shown on your wrap
  --hide-projects            Show your top projects as "Project 1-5"
  --dry-run                  Print the exact JSON packed into the link, then stop
  -y, --yes                  Skip all questions and use the defaults
  --no-open                  Print the link without opening a browser
  -h, --help                 Show this help
  -v, --version              Show the version
`;

export function parseArgs(argv) {
  const opts = {
    command: 'wrap', range: null, since: null, until: null, name: null, hideProjects: null, dryRun: false, yes: false, noOpen: false,
  };
  const value = (i, flag) => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('-')) throw new UsageError(`${flag} needs a value`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    let a = argv[i];
    let inline = null;
    if (a.startsWith('--') && a.includes('=')) [a, inline] = [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)];
    const take = () => (inline !== null ? inline : value(i++, a));
    switch (a) {
      case '--range': opts.range = take(); break;
      case '--since': opts.since = take(); break;
      case '--until': opts.until = take(); break;
      case '--name': opts.name = take(); break;
      case '--hide-projects': opts.hideProjects = true; break;
      case '--show-projects': opts.hideProjects = false; break;
      case '--dry-run': opts.dryRun = true; break;
      case '-y': case '--yes': opts.yes = true; break;
      case '--no-open': opts.noOpen = true; break;
      case '-h': case '--help': opts.command = 'help'; break;
      case '-v': case '--version': opts.command = 'version'; break;
      default:
        throw new UsageError(`Unknown ${a.startsWith('-') ? 'option' : 'command'} "${argv[i]}". Run vibe-wrapped --help.`);
    }
  }
  if ((opts.since || opts.until) && !opts.range) opts.range = 'custom';
  if (opts.range && !['year', 'all', 'custom'].includes(opts.range)) throw new UsageError(`--range must be year, all or custom`);
  return opts;
}

export class UsageError extends Error {}

/** Line-based prompt helper over any readable stream. */
function makeAsker(input, output) {
  const rl = createInterface({ input, terminal: false });
  const lines = rl[Symbol.asyncIterator]();
  return {
    async ask(question) {
      output.write(question);
      const { value, done } = await lines.next();
      return done ? '' : value.trim();
    },
    close: () => rl.close(),
  };
}

/**
 * Read-only check: Claude Code deletes transcripts after `cleanupPeriodDays` (30 by default).
 * Returns a tip string, or null when retention is already longer than the default.
 */
export function retentionTip({ home, env, found }) {
  if (!found['claude-code']) return null;
  let days = 30;
  try {
    const settings = JSON.parse(readFileSync(join(env.CLAUDE_CONFIG_DIR || join(home, '.claude'), 'settings.json'), 'utf8'));
    if (Number.isFinite(settings.cleanupPeriodDays)) days = settings.cleanupPeriodDays;
  } catch {
    // no settings file: default retention
  }
  if (days > 30) return null;
  return (
    'Tip: Claude Code only keeps about 30 days of history by default. To have a fuller wrap next time,\n' +
    '     set "cleanupPeriodDays": 365 in ~/.claude/settings.json. (vibe-wrapped never changes your settings.)'
  );
}

/**
 * Run the CLI. Everything environmental is injectable for tests.
 * @returns exit code
 */
export async function main(argv, io = {}) {
  const {
    stdin = process.stdin,
    stdout = process.stdout,
    stderr = process.stderr,
    env = process.env,
    home = env.HOME || env.USERPROFILE || homedir(),
    platform = process.platform,
    now = Date.now(),
    interactive = Boolean(stdin.isTTY),
    color = Boolean(stderr.isTTY) && !env.NO_COLOR,
    publish = publishWrap,
    open,
  } = io;
  const say = (s = '') => stderr.write(s + '\n');

  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    say(err.message);
    return 2;
  }
  if (opts.command === 'help') return stdout.write(HELP), 0;
  if (opts.command === 'version') return stdout.write(VERSION + '\n'), 0;

  const prompting = interactive && !opts.yes;
  const asker = prompting ? makeAsker(stdin, stderr) : null;
  try {
    // 1. Time range
    let rangeKind = opts.range;
    let { since, until } = opts;
    const year = new Date(now).getFullYear();
    if (!rangeKind && asker) {
      say(`Which time range should your wrap cover?\n  1) ${year} (this year)\n  2) All time\n  3) Custom range`);
      const a = await asker.ask('Choose 1-3 [1]: ');
      rangeKind = a === '2' ? 'all' : a === '3' ? 'custom' : 'year';
      if (rangeKind === 'custom') {
        since = (await asker.ask('From (YYYY-MM-DD): ')) || null;
        until = (await asker.ask(`To (YYYY-MM-DD) [${localDate(now)}]: `)) || null;
      }
    }
    let range;
    try {
      range = resolveRange({ kind: rangeKind || 'year', since, until, now });
    } catch (err) {
      say(err.message);
      return 2;
    }

    // 2. Read local history
    say(`Reading your AI coding history (${range.label})…`);
    const { sessions, found, notices } = await collectSessions({ home, env, platform });
    for (const n of notices) say(n);
    const names = { 'claude-code': 'Claude Code', codex: 'Codex', cursor: 'Cursor' };
    say(`Found: ${Object.entries(found).map(([id, ok]) => `${names[id]} ${ok ? '✓' : '–'}`).join('   ')}`);

    let wrap = computeWrap(sessions, { range, hideProjects: false });
    if (wrap.totals.sessions === 0) {
      say(
        `No AI coding activity found for ${range.label}.` +
          (range.kind === 'all' ? '' : ' Try --range all to include everything on this machine.'),
      );
      return 1;
    }

    // 3. Project names and display name
    let hideProjects = opts.hideProjects;
    const topNames = wrap.projects.top.map((p) => p.name);
    if (hideProjects === null && asker && topNames.length) {
      say(`\nYour top projects: ${topNames.join(', ')}`);
      const a = await asker.ask('Show these names publicly? (Y/n): ');
      hideProjects = /^n/i.test(a);
    }
    let displayName = opts.name;
    if (displayName === null && asker) displayName = (await asker.ask('Display name for your wrap (optional, Enter to skip): ')) || null;
    wrap = computeWrap(sessions, { range, hideProjects: Boolean(hideProjects), displayName });

    const checked = validateWrap(wrap);
    if (!checked.ok) {
      say(`Internal error: generated wrap is invalid:\n  ${checked.errors.join('\n  ')}`);
      return 1;
    }

    // 4. Summary and thin-data tip
    say(renderSummary(wrap, { color }));
    const tip = retentionTip({ home, env, found });
    if (tip && (range.fromMs === -Infinity || now - range.fromMs > 31 * 86400000)) say(tip + '\n');

    if (opts.dryRun) {
      say('Dry run: this is exactly what your link would contain. Nothing was sent.');
      stdout.write(JSON.stringify(checked.value, null, 2) + '\n');
      return 0;
    }

    return await publish({ wrap: checked.value, opts, say, stdout, env, open });
  } finally {
    asker?.close();
  }
}
