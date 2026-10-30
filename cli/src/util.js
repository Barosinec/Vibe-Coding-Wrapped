import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createInterface } from 'node:readline';

/**
 * A normalized session, the common shape every parser produces:
 *   { tool, id, project, isSubagent, events: [{ ts, kind, model?, toolName?, text?, ack? }],
 *     tokens: { input, output, cached } | null }
 * kind: 'prompt' (a human message), 'assistant' (one model response), 'tool' (one agent tool call).
 * `text` is kept only on prompts, only in memory, for the local roast counters.
 */
export function newSession(tool, id, project = null) {
  return { tool, id, project, isSubagent: false, events: [], tokens: null };
}

/** Stream a JSONL file line by line, skipping lines that don't parse. */
export async function* readJsonl(file) {
  const rl = createInterface({ input: createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    try {
      yield JSON.parse(line);
    } catch {
      // partial or corrupt line: ignore
    }
  }
}

/** Recursively list files under `dir` whose name matches `test`. Missing dirs yield nothing. */
export function walk(dir, test, maxDepth = 6) {
  const out = [];
  const rec = (d, depth) => {
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (depth < maxDepth) rec(p, depth + 1);
      } else if (e.isFile() && test(e.name)) out.push(p);
    }
  };
  rec(dir, 0);
  return out;
}

export const exists = (p) => existsSync(p);
export const mtime = (p) => {
  try {
    return statSync(p).mtimeMs;
  } catch {
    return 0;
  }
};

/** Project name = last path segment of a working directory (never the absolute path). */
export function projectName(cwd) {
  if (!cwd || typeof cwd !== 'string') return null;
  const clean = cwd.replace(/^file:\/\//, '').replace(/[\\/]+$/, '');
  const name = basename(clean.replace(/\\/g, '/'));
  if (!name || name === '~') return null;
  try {
    return decodeURIComponent(name);
  } catch {
    return name; // malformed %-escape: use the raw folder name
  }
}

export function toMs(ts) {
  if (typeof ts === 'number') return ts < 1e12 ? ts * 1000 : ts;
  if (typeof ts === 'string') {
    if (/^\d+$/.test(ts)) return toMs(Number(ts));
    const ms = Date.parse(ts);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

/** Local calendar date YYYY-MM-DD for a timestamp in ms. */
export function localDate(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Parse YYYY-MM-DD as local midnight (ms). */
export function parseLocalDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const exact = d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
  return exact ? d.getTime() : null;
}

export function addDays(dateStr, n) {
  const ms = parseLocalDate(dateStr);
  const d = new Date(ms);
  d.setDate(d.getDate() + n);
  return localDate(d.getTime());
}

const ACK = /\byou(?:'|’)?re (?:absolutely |totally |completely )?right\b/i;
export const isAck = (text) => typeof text === 'string' && ACK.test(text.slice(0, 400));

const CATEGORY_RULES = [
  ['mcp', /^(mcp__|mcp-|mcp_)/i],
  ['shell', /^(bash|bashoutput|killshell|exec|exec_command|shell|local_shell|run_terminal_cmd|run_terminal_command.*|terminal|write_stdin)$/i],
  ['edit', /^(edit|multiedit|write|notebookedit|apply_patch|edit_file.*|write_file|search_replace|str_replace.*|create_file|delete_file)$/i],
  ['read', /^(read|read_file.*|view|view_image|list_dir.*|ls|cat)$/i],
  ['search', /^(grep|glob|ripgrep.*|glob_file_search|codebase_search|file_search|grep_search|search)$/i],
  ['web', /^(webfetch|websearch|web_fetch|web_search|fetch)$/i],
  ['plan', /^(todowrite|update_plan|exitplanmode|enterplanmode|todo_write|create_plan)$/i],
  ['agent', /^(agent|task|spawn_agent|send_input|wait|await|subagent)$/i],
];

/** Map a tool-call name from any agent to one of the shared agent categories. */
export function categorizeTool(name) {
  for (const [cat, re] of CATEGORY_RULES) if (re.test(name ?? '')) return cat;
  return 'other';
}
