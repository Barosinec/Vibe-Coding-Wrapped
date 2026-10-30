// Turn normalized sessions into WrapStats (see schema.js). Pure and deterministic given `now` and TZ.
import { pickPersona } from './personas.js';
import { AGENT_CATEGORIES, SCHEMA_VERSION, TOOL_IDS, cleanLabel } from './schema.js';
import { addDays, categorizeTool, localDate, parseLocalDate } from './util.js';

export const IDLE_GAP_MS = 15 * 60 * 1000;
const MIN = 60 * 1000;
const DAY_CAP = 371; // ~53 weeks of heatmap

export const VERSION = '0.1.0';

/** Resolve a range choice into concrete bounds. `since`/`until` are YYYY-MM-DD (inclusive). */
export function resolveRange({ kind = 'year', since, until, now = Date.now() } = {}) {
  if (kind === 'all') return { kind, label: 'All time', from: null, to: null, fromMs: -Infinity, toMs: Infinity };
  if (kind === 'year') {
    const y = new Date(now).getFullYear();
    const from = `${y}-01-01`;
    const to = `${y}-12-31`;
    return { kind, label: String(y), from, to, fromMs: parseLocalDate(from), toMs: parseLocalDate(addDays(to, 1)) };
  }
  if (kind === 'custom') {
    const from = since ?? null;
    const to = until ?? localDate(now);
    if (from !== null && parseLocalDate(from) === null) throw new Error(`Invalid --since date "${since}" (use YYYY-MM-DD)`);
    if (parseLocalDate(to) === null) throw new Error(`Invalid --until date "${until}" (use YYYY-MM-DD)`);
    if (from && from > to) throw new Error('--since must be on or before --until');
    return {
      kind,
      label: `${from ?? 'Start'} → ${to}`,
      from,
      to,
      fromMs: from ? parseLocalDate(from) : -Infinity,
      toMs: parseLocalDate(addDays(to, 1)),
    };
  }
  throw new Error(`Unknown range "${kind}" (use year, all or custom)`);
}

const RE = {
  please: /\b(please|pls|plz)\b/i,
  thanks: /\b(thanks|thank you|thx|ty|cheers)\b/i,
  stillBroken: /\b(still|again)\b[^.!?\n]{0,30}\b(broken|broke|fail\w*|not work\w*|doesn['’]?t work|error\w*|wrong|bug\w*)/i,
  why: /\bwhy\b/i,
  sorry: /\b(sorry|my bad|apologi[sz]e)\b/i,
};

const emptyTokens = () => ({ input: 0, output: 0, cached: 0 });
const addTokens = (a, b) => {
  a.input += b.input;
  a.output += b.output;
  a.cached += b.cached;
};
const tokenView = (t) => ({ total: t.input + t.output + t.cached, input: t.input, output: t.output, cached: t.cached });
const argmax = (xs) => xs.reduce((best, x, i) => (x > xs[best] ? i : best), 0);
const round = (ms) => Math.round(ms / MIN);
const r4 = (x) => Math.round(x * 10000) / 10000;
const weekdayMonFirst = (ms) => (new Date(ms).getDay() + 6) % 7;

/**
 * @param sessions normalized sessions from collectSessions()
 * @param opts { range (from resolveRange), hideProjects, displayName, now }
 */
export function computeWrap(sessions, { range = resolveRange(), hideProjects = false, displayName = null } = {}) {
  const inRange = [];
  for (const s of sessions) {
    const events = s.events.filter((e) => e.ts >= range.fromMs && e.ts < range.toMs).sort((a, b) => a.ts - b.ts);
    if (events.length) inRange.push({ ...s, events });
  }

  const byHour = new Array(24).fill(0);
  const byWeekday = new Array(7).fill(0);
  const byDay = new Map();
  const tools = new Map();
  const models = new Map();
  const projects = new Map();
  const agentCounts = Object.fromEntries(AGENT_CATEGORIES.map((c) => [c, 0]));
  const roast = { please: 0, thanks: 0, stillBroken: 0, why: 0, youreRight: 0, sorry: 0, longestPromptChars: 0, avgPromptChars: 0 };
  const sessionMinutes = [];
  const totalTokens = emptyTokens();
  let prompts = 0;
  let promptChars = 0;
  let toolCalls = 0;
  let assistantTurns = 0;
  let longest = null;
  let firstMs = Infinity;
  let lastMs = -Infinity;

  const toolEntry = (id) => {
    if (!tools.has(id)) tools.set(id, { id, sessions: 0, prompts: 0, activeMs: 0, tokens: emptyTokens(), hasTokens: false });
    return tools.get(id);
  };

  for (const s of inRange) {
    const t = toolEntry(s.tool);
    if (s.tokens) {
      addTokens(t.tokens, s.tokens);
      addTokens(totalTokens, s.tokens);
      if (s.tokens.input + s.tokens.output + s.tokens.cached > 0) t.hasTokens = true;
    }

    for (const e of s.events) {
      if (e.kind === 'tool') {
        toolCalls++;
        agentCounts[categorizeTool(e.toolName)]++;
      } else if (e.kind === 'assistant') {
        assistantTurns++;
        const key = e.model || 'unknown';
        const m = models.get(key) ?? { name: key, tool: s.tool, turns: 0 };
        m.turns++;
        models.set(key, m);
        if (e.ack) roast.youreRight++;
      }
    }

    // Subagent sessions run inside a parent session: their calls/tokens count, their time and messages don't.
    if (s.isSubagent) continue;

    t.sessions++;
    let activeMs = 0;
    const ev = s.events;
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      firstMs = Math.min(firstMs, e.ts);
      lastMs = Math.max(lastMs, e.ts);
      if (e.kind === 'prompt') {
        prompts++;
        t.prompts++;
        const text = e.text ?? '';
        promptChars += text.length;
        roast.longestPromptChars = Math.max(roast.longestPromptChars, text.length);
        for (const k of ['please', 'thanks', 'stillBroken', 'why', 'sorry']) if (RE[k].test(text)) roast[k]++;
      }
      const next = ev[i + 1];
      let gap = next ? next.ts - e.ts : 0;
      if (gap >= IDLE_GAP_MS) gap = 0;
      if (i === 0 && ev.length === 1) gap = MIN; // a lone event still counts as a minute
      if (gap > 0) {
        activeMs += gap;
        byHour[new Date(e.ts).getHours()] += gap;
        byWeekday[weekdayMonFirst(e.ts)] += gap;
        const d = localDate(e.ts);
        byDay.set(d, (byDay.get(d) ?? 0) + gap);
      } else {
        const d = localDate(e.ts);
        if (!byDay.has(d)) byDay.set(d, 0);
      }
    }
    activeMs = Math.max(activeMs, MIN);
    t.activeMs += activeMs;
    sessionMinutes.push(activeMs);
    if (!longest || activeMs > longest.ms) longest = { ms: activeMs, tool: s.tool, date: localDate(ev[0].ts) };

    const name = s.project || null;
    if (name) {
      const p = projects.get(name) ?? { name, activeMs: 0, sessions: 0 };
      p.activeMs += activeMs;
      p.sessions++;
      projects.set(name, p);
    }
  }

  const totalActiveMs = sessionMinutes.reduce((a, b) => a + b, 0);
  const sessionsCount = sessionMinutes.length;
  roast.avgPromptChars = prompts ? Math.round(promptChars / prompts) : 0;

  // Tools ------------------------------------------------------------------
  const toolList = TOOL_IDS.filter((id) => tools.has(id)).map((id) => tools.get(id));
  const shareBase = totalActiveMs || prompts || 1;
  const toolOut = toolList
    .map((t) => ({
      id: t.id,
      sessions: t.sessions,
      prompts: t.prompts,
      activeMinutes: round(t.activeMs),
      share: r4(Math.min(1, (totalActiveMs ? t.activeMs : t.prompts) / shareBase)),
      tokens: tokenView(t.tokens),
      hasTokens: t.hasTokens,
    }))
    .sort((a, b) => b.share - a.share);

  // Models -----------------------------------------------------------------
  const modelOut = [...models.values()]
    .sort((a, b) => b.turns - a.turns)
    .slice(0, 5)
    .map((m) => ({ name: cleanLabel(m.name, 60) || 'unknown', tool: m.tool, turns: m.turns, share: assistantTurns ? r4(m.turns / assistantTurns) : 0 }));

  // Projects ---------------------------------------------------------------
  const projectTop = [...projects.values()]
    .sort((a, b) => b.activeMs - a.activeMs || b.sessions - a.sessions)
    .slice(0, 5)
    .map((p, i) => ({
      name: hideProjects ? `Project ${i + 1}` : cleanLabel(p.name, 60) || `Project ${i + 1}`,
      activeMinutes: round(p.activeMs),
      sessions: p.sessions,
    }));

  // Rhythm -----------------------------------------------------------------
  const days = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-DAY_CAP)
    .map(([d, ms]) => ({ d, m: Math.min(1440, round(ms)) }));
  const busiestDay = days.length ? days.reduce((b, x) => (x.m > b.m ? x : b), days[0]) : null;
  const hourMs = (hours) => hours.reduce((s, h) => s + byHour[h], 0);
  const rhythm = {
    byHour: byHour.map(round),
    byWeekday: byWeekday.map(round),
    days,
    busiestHour: argmax(byHour),
    busiestWeekday: argmax(byWeekday),
    busiestDay: busiestDay ? { date: busiestDay.d, minutes: busiestDay.m } : null,
    nightShare: totalActiveMs ? r4(Math.min(1, hourMs([22, 23, 0, 1, 2, 3]) / totalActiveMs)) : 0,
    morningShare: totalActiveMs ? r4(Math.min(1, hourMs([5, 6, 7, 8]) / totalActiveMs)) : 0,
  };

  // Marathons --------------------------------------------------------------
  const activeDates = [...byDay.keys()].sort();
  let streak = null;
  for (let i = 0, run = 1; i < activeDates.length; i++) {
    if (i > 0) run = addDays(activeDates[i - 1], 1) === activeDates[i] ? run + 1 : 1;
    if (!streak || run > streak.days) streak = { days: run, from: addDays(activeDates[i], -(run - 1)), to: activeDates[i] };
  }
  const marathons = {
    longestSession: longest ? { minutes: round(longest.ms), tool: longest.tool, date: longest.date } : null,
    longestStreak: streak,
    avgSessionMinutes: sessionsCount ? round(totalActiveMs / sessionsCount) : 0,
    longSessionShare: totalActiveMs ? r4(sessionMinutes.filter((m) => m >= 120 * MIN).reduce((a, b) => a + b, 0) / totalActiveMs) : 0,
    shortSessionShare: sessionsCount ? r4(sessionMinutes.filter((m) => m < 20 * MIN).length / sessionsCount) : 0,
  };

  // Agent ------------------------------------------------------------------
  const agent = {
    totalCalls: toolCalls,
    shellCommands: agentCounts.shell,
    fileEdits: agentCounts.edit,
    fileReads: agentCounts.read,
    searches: agentCounts.search,
    webCalls: agentCounts.web,
    top: AGENT_CATEGORIES.map((category) => ({ category, count: agentCounts[category] }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count),
  };

  const spanDays =
    firstMs === Infinity ? 0 : Math.round((parseLocalDate(localDate(lastMs)) - parseLocalDate(localDate(firstMs))) / 86400000) + 1;

  const wrap = {
    schemaVersion: SCHEMA_VERSION,
    generator: `vibe-wrapped@${VERSION}`,
    displayName: displayName ? cleanLabel(displayName, 40) || null : null,
    range: { kind: range.kind, label: range.label, from: range.from, to: range.to },
    coverage: {
      firstDay: firstMs === Infinity ? null : localDate(firstMs),
      lastDay: lastMs === -Infinity ? null : localDate(lastMs),
      activeDays: activeDates.length,
      spanDays,
    },
    totals: {
      sessions: sessionsCount,
      prompts,
      activeMinutes: round(totalActiveMs),
      toolCalls,
      tokens: tokenView(totalTokens),
    },
    tools: toolOut,
    models: modelOut,
    projects: { hidden: Boolean(hideProjects), count: projects.size, top: projectTop },
    rhythm,
    marathons,
    agent,
    roast,
    persona: { id: 'loyalist' },
  };
  wrap.persona = { id: pickPersona(wrap).id }; // scored on the real project count
  if (hideProjects) wrap.projects.count = projectTop.length; // hidden: don't reveal how many projects exist
  return wrap;
}

/** Top project names (real), for the "show these publicly?" prompt. */
export function topProjectNames(sessions, range) {
  const wrap = computeWrap(sessions, { range, hideProjects: false });
  return wrap.projects.top.map((p) => p.name);
}
