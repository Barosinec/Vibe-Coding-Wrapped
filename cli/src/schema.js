// WrapStats: the only thing that ever leaves the user's machine.
// Shared by the CLI (produces it) and the website (validates and stores it).
// `validateWrap` checks types and limits and returns a copy containing only known fields.

import { PERSONA_IDS } from './personas.js';

export const SCHEMA_VERSION = 1;
export const MAX_PAYLOAD_BYTES = 64 * 1024;
export const TOOL_IDS = ['claude-code', 'codex', 'cursor'];
export const TOOL_NAMES = { 'claude-code': 'Claude Code', codex: 'Codex', cursor: 'Cursor' };
export const AGENT_CATEGORIES = ['shell', 'edit', 'read', 'search', 'web', 'plan', 'agent', 'mcp', 'other'];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** A real calendar date in YYYY-MM-DD (rejects 2026-02-30, 2026-99-99). */
export function isCalendarDate(s) {
  if (typeof s !== 'string' || !DATE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}
const LABEL = /^[\p{L}\p{N} .,:'’()&+#@/_–→-]*$/u; // plain text only, no markup

// --- tiny schema DSL -------------------------------------------------------
const int = (max = Number.MAX_SAFE_INTEGER) => ({ t: 'int', max });
const num = (min, max) => ({ t: 'num', min, max });
const str = (max, { pattern, nullable = false, oneOf } = {}) => ({ t: 'str', max, pattern, nullable, oneOf });
const bool = () => ({ t: 'bool' });
const arr = (of, maxLen, len) => ({ t: 'arr', of, maxLen, len });
const obj = (fields, { nullable = false } = {}) => ({ t: 'obj', fields, nullable });

const share = num(0, 1);
const tokens = obj({ total: int(), input: int(), output: int(), cached: int() });
const label = (max) => str(max, { pattern: LABEL });

export const WRAP_SCHEMA = obj({
  schemaVersion: int(SCHEMA_VERSION),
  generator: str(40, { pattern: /^vibe-wrapped@[0-9A-Za-z.+-]+$/ }),
  displayName: str(40, { pattern: LABEL, nullable: true }),
  range: obj({
    kind: str(10, { oneOf: ['year', 'all', 'custom'] }),
    label: label(40),
    from: str(10, { pattern: DATE, nullable: true }),
    to: str(10, { pattern: DATE, nullable: true }),
  }),
  coverage: obj({
    firstDay: str(10, { pattern: DATE, nullable: true }),
    lastDay: str(10, { pattern: DATE, nullable: true }),
    activeDays: int(100000),
    spanDays: int(100000),
  }),
  totals: obj({
    sessions: int(),
    prompts: int(),
    activeMinutes: int(),
    toolCalls: int(),
    tokens,
  }),
  tools: arr(
    obj({
      id: str(20, { oneOf: TOOL_IDS }),
      sessions: int(),
      prompts: int(),
      activeMinutes: int(),
      share,
      tokens,
      hasTokens: bool(),
    }),
    3,
  ),
  models: arr(obj({ name: label(60), tool: str(20, { oneOf: TOOL_IDS }), turns: int(), share }), 5),
  projects: obj({
    hidden: bool(),
    count: int(100000),
    top: arr(obj({ name: label(60), activeMinutes: int(), sessions: int() }), 5),
  }),
  rhythm: obj({
    byHour: arr(int(), 24, 24),
    byWeekday: arr(int(), 7, 7), // minutes, Monday first
    days: arr(obj({ d: str(10, { pattern: DATE }), m: int(1440) }), 400),
    busiestHour: int(23),
    busiestWeekday: int(6),
    busiestDay: obj({ date: str(10, { pattern: DATE }), minutes: int(1440) }, { nullable: true }),
    nightShare: share,
    morningShare: share,
  }),
  marathons: obj({
    longestSession: obj(
      { minutes: int(), tool: str(20, { oneOf: TOOL_IDS }), date: str(10, { pattern: DATE }) },
      { nullable: true },
    ),
    longestStreak: obj(
      { days: int(100000), from: str(10, { pattern: DATE }), to: str(10, { pattern: DATE }) },
      { nullable: true },
    ),
    avgSessionMinutes: int(),
    longSessionShare: share,
    shortSessionShare: share,
  }),
  agent: obj({
    totalCalls: int(),
    shellCommands: int(),
    fileEdits: int(),
    fileReads: int(),
    searches: int(),
    webCalls: int(),
    top: arr(obj({ category: str(10, { oneOf: AGENT_CATEGORIES }), count: int() }), AGENT_CATEGORIES.length),
  }),
  roast: obj({
    please: int(),
    thanks: int(),
    stillBroken: int(),
    why: int(),
    youreRight: int(),
    sorry: int(),
    longestPromptChars: int(),
    avgPromptChars: int(),
  }),
  persona: obj({ id: str(30, { oneOf: PERSONA_IDS }) }),
});

function check(spec, v, path, errors) {
  const fail = (msg) => {
    errors.push(`${path || 'wrap'}: ${msg}`);
    return undefined;
  };
  switch (spec.t) {
    case 'int':
      if (!Number.isInteger(v) || v < 0 || v > spec.max) return fail('expected integer in range');
      return v;
    case 'num':
      if (typeof v !== 'number' || !Number.isFinite(v) || v < spec.min || v > spec.max) return fail('expected number in range');
      return v;
    case 'bool':
      if (typeof v !== 'boolean') return fail('expected boolean');
      return v;
    case 'str':
      if (v === null && spec.nullable) return null;
      if (typeof v !== 'string' || v.length > spec.max) return fail('expected short string');
      if (spec.pattern && !spec.pattern.test(v)) return fail('invalid characters');
      if (spec.pattern === DATE && !isCalendarDate(v)) return fail('not a calendar date');
      if (spec.oneOf && !spec.oneOf.includes(v)) return fail('unknown value');
      return v;
    case 'arr': {
      if (!Array.isArray(v)) return fail('expected array');
      if (v.length > spec.maxLen || (spec.len !== undefined && v.length !== spec.len)) return fail('wrong length');
      return v.map((x, i) => check(spec.of, x, `${path}[${i}]`, errors));
    }
    case 'obj': {
      if (v === null && spec.nullable) return null;
      if (!v || typeof v !== 'object' || Array.isArray(v)) return fail('expected object');
      const out = {};
      for (const [k, s] of Object.entries(spec.fields)) out[k] = check(s, v[k], path ? `${path}.${k}` : k, errors);
      return out;
    }
  }
  return fail('bad schema');
}

/** Validate an untrusted wrap. Returns `{ ok: true, value }` (unknown fields removed) or `{ ok: false, errors }`. */
export function validateWrap(input) {
  const errors = [];
  let size = 0;
  try {
    size = new TextEncoder().encode(JSON.stringify(input) ?? '').length;
  } catch {
    return { ok: false, errors: ['wrap: not serializable'] };
  }
  if (size > MAX_PAYLOAD_BYTES) return { ok: false, errors: [`wrap: larger than ${MAX_PAYLOAD_BYTES} bytes`] };
  const value = check(WRAP_SCHEMA, input, '', errors);
  if (!errors.length && value.schemaVersion !== SCHEMA_VERSION) errors.push('schemaVersion: unsupported');
  return errors.length ? { ok: false, errors: errors.slice(0, 20) } : { ok: true, value };
}

/** Make a user-supplied label safe for the public page (drop markup-ish characters, trim). */
export function cleanLabel(s, max = 60) {
  return String(s ?? '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N} .,:'’()&+#@/_–→-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}
