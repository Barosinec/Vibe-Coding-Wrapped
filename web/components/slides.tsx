'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { personaById } from '@vibewrap/vibe-wrapped/personas';
import type { WrapStats } from '@vibewrap/vibe-wrapped/schema';
import {
  AGENT_LABEL,
  PERSONA_GRADIENT,
  TOOL,
  WEEKDAYS,
  fmtCount,
  fmtDay,
  fmtDuration,
  fmtHour,
  fmtHours,
  pct,
  plural,
  prettyModel,
  tokenComparison,
} from '@/lib/format';
import { showHeatmap, showStreak, type SlideId } from '@/lib/slides';

/** Background per slide. Persona and summary depend on the wrap. */
export function slideTheme(id: SlideId, s: WrapStats): { bg: string; ink: 'light' | 'dark' } {
  const p = PERSONA_GRADIENT[s.persona.id] ?? ['#4A1FFF', '#FF3DAA'];
  const themes: Record<SlideId, { bg: string; ink: 'light' | 'dark' }> = {
    intro: { bg: 'linear-gradient(160deg, #4A1FFF 0%, #B42BFF 55%, #FF3DAA 100%)', ink: 'light' },
    numbers: { bg: 'linear-gradient(170deg, #FF6A1A 0%, #FFC21A 100%)', ink: 'dark' },
    tools: { bg: 'linear-gradient(180deg, #170C45 0%, #2A1170 100%)', ink: 'light' },
    models: { bg: 'linear-gradient(155deg, #00BFA6 0%, #1F4BFF 100%)', ink: 'light' },
    tokens: { bg: 'linear-gradient(165deg, #FF2E63 0%, #6A0DFF 100%)', ink: 'light' },
    projects: { bg: 'linear-gradient(180deg, #D7FF3A 0%, #9DF03A 100%)', ink: 'dark' },
    rhythm: { bg: 'linear-gradient(180deg, #070B33 0%, #3B1C78 100%)', ink: 'light' },
    marathons: { bg: 'linear-gradient(160deg, #FF8A00 0%, #FF2E63 100%)', ink: 'light' },
    agent: { bg: 'linear-gradient(150deg, #00D9FF 0%, #4A1FFF 100%)', ink: 'light' },
    roast: { bg: 'linear-gradient(170deg, #FFE14D 0%, #FF8A1A 100%)', ink: 'dark' },
    persona: { bg: `linear-gradient(160deg, ${p[0]} 0%, ${p[1]} 100%)`, ink: 'light' },
    summary: { bg: 'linear-gradient(180deg, #F4F2FF 0%, #DCD3FF 100%)', ink: 'dark' },
  };
  return themes[id];
}

/** Counts up from 0 when the slide becomes active (static under reduced motion). */
export function CountUp({ value, format = fmtCount, active, decimals = 0 }: { value: number; format?: (n: number) => string; active: boolean; decimals?: number }) {
  const [shown, setShown] = useState(active ? 0 : value);
  useEffect(() => {
    if (!active) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setShown(value);
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 1100);
      setShown(value * (1 - Math.pow(1 - k, 4)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, value]);
  const k = 10 ** decimals;
  return <span className="tabular">{format(Math.round(shown * k) / k)}</span>;
}

function Shapes({ variant }: { variant: number }) {
  // Decorative blobs and a squiggle; positions vary per slide.
  // Corners only, so they never sit behind text.
  const sets: [string, string, string][] = [
    ['-18%', '80%', '#D7FF3A'],
    ['66%', '-9%', '#FF3DAA'],
    ['-6%', '4%', '#00E0FF'],
  ];
  const [a, b, c] = sets.map((s, i) => sets[(i + variant) % sets.length]);
  return (
    <div className="shapes" aria-hidden="true">
      <span className="blob" style={{ left: a[0], top: a[1], background: a[2] }} />
      <span className="ring" style={{ left: b[0], top: b[1], borderColor: b[2] }} />
      <svg className="squiggle" style={{ left: c[0], top: c[1] }} viewBox="0 0 120 40" fill="none">
        <path d="M2 20 Q 17 2 32 20 T 62 20 T 92 20 T 118 20" stroke={c[2]} strokeWidth="7" strokeLinecap="round" />
      </svg>
    </div>
  );
}

const Kicker = ({ children }: { children: ReactNode }) => <p className="kicker">{children}</p>;
const Tool = ({ id }: { id: keyof typeof TOOL }) => (
  <span className="mono tool-name" style={{ '--tool': TOOL[id].color } as CSSProperties}>
    {TOOL[id].name}
  </span>
);

type P = { s: WrapStats; active: boolean };

function Intro({ s }: P) {
  const c = s.coverage;
  return (
    <>
      <Shapes variant={1} />
      <div className="slide-body bottom">
        {s.displayName && <p className="hello">Hey {s.displayName}.</p>}
        <h2 className="mega">
          Your {s.range.kind === 'year' ? s.range.label : s.range.kind === 'all' ? 'all-time' : 'custom'}
          <br />
          in vibe coding
        </h2>
        <p className="meta">
          {c.firstDay
            ? `Based on ${plural(c.activeDays, 'active day')} of history · ${fmtDay(c.firstDay, true)} – ${fmtDay(c.lastDay!, true)}`
            : 'No activity in this range yet'}
        </p>
        <p className="hint">Tap to start</p>
      </div>
    </>
  );
}

function Numbers({ s, active }: P) {
  const h = fmtHours(s.totals.activeMinutes);
  return (
    <>
      <Shapes variant={0} />
      <div className="slide-body">
        <Kicker>You and your agents spent</Kicker>
        <p className="giant">
          <CountUp
            value={Number(h.value.replace(/,/g, ''))}
            decimals={h.value.includes('.') ? 1 : 0}
            format={(n) => n.toLocaleString('en-US', { maximumFractionDigits: 1 })}
            active={active}
          />
        </p>
        <p className="giant-unit">{h.unit} together</p>
        <div className="stat-row">
          <div>
            <strong>
              <CountUp value={s.totals.sessions} active={active} />
            </strong>
            <span>sessions</span>
          </div>
          <div>
            <strong>
              <CountUp value={s.totals.prompts} active={active} />
            </strong>
            <span>prompts sent</span>
          </div>
        </div>
      </div>
    </>
  );
}

function Tools({ s }: P) {
  const top = s.tools[0];
  const only = s.tools.length === 1;
  return (
    <div className="slide-body">
      <Kicker>{only ? 'One tool. Total devotion.' : 'Your agent line-up'}</Kicker>
      <h2 className="headline">
        {only ? (
          <>
            100% <Tool id={top.id} />
          </>
        ) : (
          <>
            <Tool id={top.id} /> took the crown 👑
          </>
        )}
      </h2>
      <ul className="bars">
        {s.tools.map((t) => (
          <li key={t.id}>
            <div className="bar-label">
              <Tool id={t.id} />
              <span className="tabular">{pct(t.share)}</span>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${Math.max(3, t.share * 100)}%`, background: TOOL[t.id].color }} />
            </div>
            <p className="bar-note">
              {plural(t.sessions, 'session')} · {fmtDuration(t.activeMinutes)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Models({ s }: P) {
  const [first, ...rest] = s.models;
  return (
    <>
      <Shapes variant={2} />
      <div className="slide-body">
        <Kicker>Your ride-or-die model</Kicker>
        <h2 className="headline">{prettyModel(first.name)}</h2>
        <p className="mono model-id">{first.name}</p>
        <p className="lede">
          {pct(first.share)} of every answer you got came from it, via <Tool id={first.tool} />.
        </p>
        {rest.length > 0 && (
          <ol className="ranked">
            {rest.map((m, i) => (
              <li key={m.name}>
                <span className="rank">{i + 2}</span>
                <span className="mono">{m.name}</span>
                <span className="tabular">{pct(m.share)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  );
}

function Tokens({ s, active }: P) {
  const t = s.totals.tokens;
  const cursor = s.tools.some((x) => x.id === 'cursor');
  return (
    <>
      <Shapes variant={0} />
      <div className="slide-body">
        <Kicker>Tokens burned</Kicker>
        <p className="giant">
          <CountUp value={t.total} active={active} />
        </p>
        <p className="lede">{tokenComparison(t.total)}</p>
        <dl className="split">
          <div>
            <dt>Read from cache</dt>
            <dd className="tabular">{fmtCount(t.cached)}</dd>
          </div>
          <div>
            <dt>Fresh input</dt>
            <dd className="tabular">{fmtCount(t.input)}</dd>
          </div>
          <div>
            <dt>Written by AI</dt>
            <dd className="tabular">{fmtCount(t.output)}</dd>
          </div>
        </dl>
        {cursor && <p className="footnote">Cursor doesn’t record tokens, so it isn’t counted here.</p>}
      </div>
    </>
  );
}

function Projects({ s }: P) {
  const [first] = s.projects.top;
  return (
    <div className="slide-body">
      <Kicker>{s.projects.hidden ? 'Your top projects (names kept secret)' : 'Where the magic happened'}</Kicker>
      <h2 className="headline mono-head">{first.name}</h2>
      <p className="lede">
        {fmtDuration(first.activeMinutes)} across {plural(first.sessions, 'session')}.
        {s.projects.count > 1 && !s.projects.hidden ? ` One of ${s.projects.count} projects you touched.` : ''}
      </p>
      <ol className="ranked big">
        {s.projects.top.map((p, i) => (
          <li key={p.name + i}>
            <span className="rank">{i + 1}</span>
            <span className="mono">{p.name}</span>
            <span className="tabular">{fmtDuration(p.activeMinutes)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Heatmap({ days }: { days: { d: string; m: number }[] }) {
  const max = Math.max(...days.map((d) => d.m), 1);
  const byDate = new Map(days.map((d) => [d.d, d.m]));
  const first = new Date(days[0].d + 'T00:00:00Z');
  const last = new Date(days[days.length - 1].d + 'T00:00:00Z');
  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7)); // back to Monday
  const cells: { key: string; level: number }[] = [];
  for (let t = start.getTime(); t <= last.getTime(); t += 86_400_000) {
    const key = new Date(t).toISOString().slice(0, 10);
    const m = byDate.get(key) ?? 0;
    cells.push({ key, level: m === 0 ? 0 : Math.ceil((m / max) * 4) });
  }
  return (
    <div className="heatmap" role="img" aria-label={`Activity heatmap across ${days.length} active days`}>
      {cells.map((c) => (
        <span key={c.key} className={`lvl${c.level}`} />
      ))}
    </div>
  );
}

function Rhythm({ s }: P) {
  const r = s.rhythm;
  const max = Math.max(...r.byHour, 1);
  const night = r.nightShare >= 0.3;
  return (
    <>
      <div className="stars" aria-hidden="true" />
      <div className="slide-body">
        <Kicker>Your rhythm</Kicker>
        <h2 className="headline">
          Peak hour: <span className="hl">{fmtHour(r.busiestHour)}</span>
        </h2>
        <p className="lede">
          {night ? `${pct(r.nightShare)} of your coding happened after 10pm. ` : ''}
          {WEEKDAYS[r.busiestWeekday]}s were your biggest day.
        </p>
        <div className="hours" role="img" aria-label={`Activity by hour, peaking at ${fmtHour(r.busiestHour)}`}>
          {r.byHour.map((m, h) => (
            <span key={h} style={{ height: `${Math.max(4, (m / max) * 100)}%` }} className={h === r.busiestHour ? 'peak' : ''} />
          ))}
        </div>
        <div className="hours-axis mono">
          <span>12am</span>
          <span>6am</span>
          <span>12pm</span>
          <span>6pm</span>
        </div>
        {showHeatmap(s) && <Heatmap days={r.days} />}
        {r.busiestDay && <p className="footnote">Biggest day: {fmtDay(r.busiestDay.date, true)}, {fmtDuration(r.busiestDay.minutes)} of vibe coding.</p>}
      </div>
    </>
  );
}

function Marathons({ s, active }: P) {
  const l = s.marathons.longestSession;
  const st = s.marathons.longestStreak;
  return (
    <>
      <Shapes variant={1} />
      <div className="slide-body">
        {l && (
          <>
            <Kicker>Your longest session</Kicker>
            <p className="giant">
              <CountUp value={l.minutes} format={(n) => fmtDuration(n)} active={active} />
            </p>
            <p className="lede">
              On {fmtDay(l.date, true)} in <Tool id={l.tool} />. Snacks were probably involved.
            </p>
          </>
        )}
        {showStreak(s) && st && (
          <div className="streak">
            <span className="streak-num tabular">{st.days}</span>
            <span>
              day streak
              <br />
              <small>
                {fmtDay(st.from)} – {fmtDay(st.to)}
              </small>
            </span>
          </div>
        )}
      </div>
    </>
  );
}

function Agent({ s, active }: P) {
  const top = s.agent.top.slice(0, 4);
  return (
    <div className="slide-body">
      <Kicker>Your agents’ favourite moves</Kicker>
      <p className="giant">
        <CountUp value={s.agent.totalCalls} active={active} />
      </p>
      <p className="giant-unit">tool calls made on your behalf</p>
      <div className="terminal mono" aria-label="Top agent actions">
        {top.map((t) => (
          <p key={t.category}>
            <span className="prompt">$</span> {fmtCount(t.count)} {AGENT_LABEL[t.category]}
          </p>
        ))}
        <p className="cursor-line">
          <span className="prompt">$</span> <span className="caret" />
        </p>
      </div>
    </div>
  );
}

function Roast({ s }: P) {
  const r = s.roast;
  const lines: [number, ReactNode][] = [
    [r.please, <>You said <q>please</q> {plural(r.please, 'time')}. The robots will remember.</>],
    [r.youreRight, <>Your AI told you <q>you’re right</q> {plural(r.youreRight, 'time')}.</>],
    [r.stillBroken, <>{plural(r.stillBroken, 'prompt')} said it was <q>still broken</q>.</>],
    [r.why, <>You asked <q>why</q> {plural(r.why, 'time')}.</>],
    [r.thanks, <>And said thanks {plural(r.thanks, 'time')}. Manners!</>],
    [r.sorry, <>You apologised to a computer {plural(r.sorry, 'time')}.</>],
  ];
  const shown = lines.filter(([n]) => n > 0).slice(0, 3);
  return (
    <div className="slide-body">
      <Kicker>Let’s talk about you</Kicker>
      <h2 className="headline">The receipts</h2>
      <ul className="receipts">
        {shown.map(([, text], i) => (
          <li key={i}>{text}</li>
        ))}
        <li>
          Your longest prompt ran {r.longestPromptChars.toLocaleString('en-US')} characters
          {r.avgPromptChars ? ` (you average ${r.avgPromptChars})` : ''}.
        </li>
      </ul>
    </div>
  );
}

function PersonaSlide({ s }: P) {
  const p = personaById(s.persona.id);
  if (!p) return null;
  return (
    <>
      <Shapes variant={2} />
      <div className="slide-body center">
        <Kicker>Your vibe coding persona is</Kicker>
        <p className="persona-emoji" aria-hidden="true">
          {p.emoji}
        </p>
        <h2 className="mega persona-name">{p.name}</h2>
        <p className="tagline">{p.tagline}</p>
        <p className="lede">{p.description}</p>
      </div>
    </>
  );
}

export function Summary({ s, storyUrl, onCopy, copied }: P & { storyUrl: string; onCopy: () => void; copied: boolean }) {
  const p = personaById(s.persona.id);
  const h = fmtHours(s.totals.activeMinutes);
  const [g0, g1] = PERSONA_GRADIENT[s.persona.id] ?? ['#4A1FFF', '#FF3DAA'];
  return (
    <div className="slide-body summary">
      <div className="summary-card" style={{ background: `linear-gradient(160deg, ${g0}, ${g1})` }}>
        <p className="summary-title">
          {s.displayName ? `${s.displayName}’s ` : ''}
          {s.range.kind === 'year' ? s.range.label : s.range.label} Vibe Wrapped
        </p>
        {p && (
          <p className="summary-persona">
            <span aria-hidden="true">{p.emoji}</span> {p.name}
          </p>
        )}
        <dl className="summary-grid">
          <div>
            <dt>Time with AI</dt>
            <dd>
              {h.value} {h.unit === 'hours' ? 'h' : 'min'}
            </dd>
          </div>
          <div>
            <dt>Prompts</dt>
            <dd>{fmtCount(s.totals.prompts)}</dd>
          </div>
          {s.tools[0] && (
            <div>
              <dt>Top tool</dt>
              <dd className="mono">{TOOL[s.tools[0].id].name}</dd>
            </div>
          )}
          {s.models[0] && (
            <div>
              <dt>Top model</dt>
              <dd className="mono">{prettyModel(s.models[0].name)}</dd>
            </div>
          )}
          {s.totals.tokens.total > 0 && (
            <div>
              <dt>Tokens</dt>
              <dd>{fmtCount(s.totals.tokens.total)}</dd>
            </div>
          )}
          {s.projects.top[0] && (
            <div>
              <dt>Top project</dt>
              <dd className="mono">{s.projects.top[0].name}</dd>
            </div>
          )}
        </dl>
        <p className="summary-brand mono">npx @vibewrap/vibe-wrapped</p>
      </div>
      <div className="actions" data-no-nav>
        <a className="btn primary" href={storyUrl} download="vibe-wrapped-story.png">
          Download story image
        </a>
        <button className="btn" type="button" onClick={onCopy}>
          {copied ? 'Link copied' : 'Copy link'}
        </button>
        <a className="btn ghost" href="/">
          Make your own
        </a>
      </div>
    </div>
  );
}

export const SLIDES: Record<Exclude<SlideId, 'summary'>, (p: P) => ReactNode> = {
  intro: Intro,
  numbers: Numbers,
  tools: Tools,
  models: Models,
  tokens: Tokens,
  projects: Projects,
  rhythm: Rhythm,
  marathons: Marathons,
  agent: Agent,
  roast: Roast,
  persona: PersonaSlide,
};
