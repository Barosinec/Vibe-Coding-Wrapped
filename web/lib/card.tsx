// Share images rendered with next/og (Satori): flexbox only, inline styles, bundled fonts.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ImageResponse } from 'next/og';
import { personaById } from '@vibewrap/vibe-wrapped/personas';
import type { WrapStats } from '@vibewrap/vibe-wrapped/schema';
import { PERSONA_GRADIENT, TOOL, fmtCount, fmtHours, prettyModel } from './format';

// Font files ship in @fontsource packages; look for node_modules from the app dir upwards
// (npm workspaces hoist them to the repo root).
async function fontFile(pkg: string, file: string): Promise<Buffer> {
  let dir = process.cwd();
  for (let i = 0; i < 4; i++) {
    try {
      return await readFile(join(dir, 'node_modules', pkg, 'files', file));
    } catch {
      dir = dirname(dir);
    }
  }
  throw new Error(`Font not found: ${pkg}/${file}`);
}

let fonts: Promise<{ name: string; data: Buffer; weight: 600 | 700 | 800; style: 'normal' }[]> | null = null;
function loadFonts() {
  const font = (name: string, pkg: string, file: string, weight: 600 | 700 | 800) =>
    fontFile(pkg, file).then((data) => ({ name, data, weight, style: 'normal' as const }));
  fonts ??= Promise.all([
    font('Bricolage', '@fontsource/bricolage-grotesque', 'bricolage-grotesque-latin-800-normal.woff', 800),
    font('Bricolage', '@fontsource/bricolage-grotesque', 'bricolage-grotesque-latin-600-normal.woff', 600),
    font('JetBrains', '@fontsource/jetbrains-mono', 'jetbrains-mono-latin-700-normal.woff', 700),
  ]);
  return fonts;
}

const INK = '#140B3A';
const LIME = '#D7FF3A';

function headline(s: WrapStats) {
  return `${s.displayName ? `${s.displayName}’s ` : ''}${s.range.label} Vibe Wrapped`;
}

function stats(s: WrapStats) {
  const h = fmtHours(s.totals.activeMinutes);
  const out: { k: string; v: string; mono?: boolean }[] = [
    { k: 'Time with AI', v: `${h.value} ${h.unit === 'hours' ? 'h' : 'min'}` },
    { k: 'Prompts', v: fmtCount(s.totals.prompts) },
  ];
  if (s.tools[0]) out.push({ k: 'Top tool', v: TOOL[s.tools[0].id].name, mono: true });
  if (s.models[0]) out.push({ k: 'Top model', v: prettyModel(s.models[0].name), mono: true });
  if (s.totals.tokens.total > 0) out.push({ k: 'Tokens', v: fmtCount(s.totals.tokens.total) });
  out.push({ k: 'Sessions', v: fmtCount(s.totals.sessions) });
  return out;
}

function ToolBar({ s, height }: { s: WrapStats; height: number }) {
  return (
    <div style={{ display: 'flex', width: '100%', height, borderRadius: height / 2, overflow: 'hidden', background: 'rgba(255,255,255,0.15)' }}>
      {s.tools.map((t) => (
        <div key={t.id} style={{ display: 'flex', width: `${Math.max(2, t.share * 100)}%`, height: '100%', background: TOOL[t.id].color }} />
      ))}
    </div>
  );
}

/** 1200×630 link preview: persona + three big stats. */
export async function ogImage(s: WrapStats | null) {
  const size = { width: 1200, height: 630 };
  if (!s) {
    return new ImageResponse(
      (
        <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(150deg, #4A1FFF, #FF3DAA)', color: '#fff', fontFamily: 'Bricolage', fontSize: 96, fontWeight: 800 }}>
          Vibe Wrapped
        </div>
      ),
      { ...size, fonts: await loadFonts() },
    );
  }
  const p = personaById(s.persona.id);
  const [g0, g1] = PERSONA_GRADIENT[s.persona.id] ?? ['#4A1FFF', '#FF3DAA'];
  const top = stats(s).slice(0, 3);
  return new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: '56px 64px', background: `linear-gradient(150deg, ${g0}, ${g1})`, color: '#fff', fontFamily: 'Bricolage' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 30, fontWeight: 600 }}>
          <span>{headline(s)}</span>
          <span style={{ fontFamily: 'JetBrains', fontSize: 24, color: LIME }}>npx @vibewrap/vibe-wrapped</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginTop: 'auto' }}>
          <span style={{ fontSize: 120 }}>{p?.emoji}</span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 30, fontWeight: 600, opacity: 0.85 }}>Vibe coding persona</span>
            <span style={{ fontSize: 96, fontWeight: 800, letterSpacing: -4, lineHeight: 1 }}>{p?.name}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24, marginTop: 44 }}>
          {top.map((x) => (
            <div key={x.k} style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '18px 24px', borderRadius: 24, background: 'rgba(255,255,255,0.14)' }}>
              <span style={{ fontSize: 24, fontWeight: 600, opacity: 0.85 }}>{x.k}</span>
              <span style={{ fontSize: x.mono ? 40 : 56, fontWeight: x.mono ? 700 : 800, fontFamily: x.mono ? 'JetBrains' : 'Bricolage', letterSpacing: x.mono ? 0 : -2 }}>{x.v}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size, fonts: await loadFonts(), emoji: 'twemoji' },
  );
}

/** 1080×1920 story image (Instagram/TikTok stories). */
export async function storyImage(s: WrapStats, filename: string) {
  const p = personaById(s.persona.id);
  const [g0, g1] = PERSONA_GRADIENT[s.persona.id] ?? ['#4A1FFF', '#FF3DAA'];
  const grid = stats(s);
  const res = new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: '120px 88px 110px', background: `linear-gradient(165deg, ${g0}, ${g1})`, color: '#fff', fontFamily: 'Bricolage' }}>
        <span style={{ fontFamily: 'JetBrains', fontSize: 34, color: LIME }}>vibe wrapped</span>
        <span style={{ marginTop: 28, fontSize: 64, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05 }}>{headline(s)}</span>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 110 }}>
          <span style={{ fontSize: 220, lineHeight: 1 }}>{p?.emoji}</span>
          <span style={{ marginTop: 30, fontSize: 40, fontWeight: 600, opacity: 0.85 }}>Your vibe coding persona</span>
          <span style={{ fontSize: 132, fontWeight: 800, letterSpacing: -6, lineHeight: 0.95 }}>{p?.name}</span>
          <span style={{ marginTop: 20, fontFamily: 'JetBrains', fontSize: 34 }}>{p?.tagline}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 90, rowGap: 44 }}>
          {grid.map((x) => (
            <div key={x.k} style={{ display: 'flex', flexDirection: 'column', width: '50%' }}>
              <span style={{ fontSize: 34, fontWeight: 600, opacity: 0.8 }}>{x.k}</span>
              <span style={{ fontSize: x.mono ? 50 : 80, fontWeight: x.mono ? 700 : 800, fontFamily: x.mono ? 'JetBrains' : 'Bricolage', letterSpacing: x.mono ? 0 : -3 }}>{x.v}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto', gap: 22 }}>
          <ToolBar s={s} height={34} />
          <div style={{ display: 'flex', gap: 36, fontFamily: 'JetBrains', fontSize: 30 }}>
            {s.tools.map((t) => (
              <span key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ display: 'flex', width: 22, height: 22, borderRadius: 11, background: TOOL[t.id].color }} />
                {TOOL[t.id].name} {Math.round(t.share * 100)}%
              </span>
            ))}
          </div>
          <span style={{ marginTop: 30, fontFamily: 'JetBrains', fontSize: 36, color: INK, background: LIME, padding: '14px 26px', borderRadius: 40, alignSelf: 'flex-start' }}>
            npx @vibewrap/vibe-wrapped
          </span>
        </div>
      </div>
    ),
    { width: 1080, height: 1920, fonts: await loadFonts(), emoji: 'twemoji' },
  );
  res.headers.set('content-disposition', `attachment; filename="${filename}"`);
  res.headers.set('cache-control', 'no-store');
  return res;
}
