import Link from 'next/link';
import { personaById } from '@vibewrap/vibe-wrapped/personas';
import CopyCommand from '@/components/CopyCommand';
import { DEMO_STATS } from '@/lib/demo';
import { TOOL, fmtCount, fmtHours } from '@/lib/format';

// The exact shape packed into a wrap link, using the demo wrap (heatmap days trimmed for display).
function payloadPreview() {
  const { rhythm, ...rest } = DEMO_STATS;
  const shown = { ...rest, rhythm: { ...rhythm, days: [...rhythm.days.slice(0, 2), '…one entry per active day: { d, m }'] } };
  return JSON.stringify(shown, null, 2);
}

const GITHUB_URL = 'https://github.com/Barosinec/Vibe-Coding-Wrapped';

const TOOLS = [
  { id: 'claude-code' as const, where: '~/.claude/projects/*.jsonl' },
  { id: 'codex' as const, where: '~/.codex/sessions/**/rollout-*.jsonl' },
  { id: 'cursor' as const, where: 'Cursor/User/globalStorage/state.vscdb' },
];

export default function Home() {
  const persona = personaById(DEMO_STATS.persona.id)!;
  const hours = fmtHours(DEMO_STATS.totals.activeMinutes);
  return (
    <main className="home">
      <header className="hero">
        <nav className="hero-nav">
          <span className="mono brand">vibe wrapped</span>
          <span className="hero-links">
            <Link href="/demo">See a demo</Link>
            <a href={GITHUB_URL} rel="noopener">
              GitHub
            </a>
          </span>
        </nav>
        <div className="hero-grid">
          <div>
            <h1>Your year of vibe coding, wrapped.</h1>
            <p className="hero-sub">
              One command reads your Claude Code, Codex and Cursor history on your own machine and turns it into a story you’ll actually want to post.
            </p>
            <div className="hero-ctas">
              <CopyCommand />
              <Link className="btn" href="/demo">
                See a demo
              </Link>
            </div>
          </div>
          <div className="deck" aria-hidden="true">
            <div className="card card-a">
              <p className="k">You and your agents spent</p>
              <p className="v">{hours.value}</p>
              <p className="k">{hours.unit} together</p>
            </div>
            <div className="card card-c">
              <p className="k">Your agent line-up</p>
              <div className="mini-bars">
                {DEMO_STATS.tools.map((t) => (
                  <span key={t.id} style={{ width: `${t.share * 100}%`, background: TOOL[t.id].color }} />
                ))}
              </div>
              <p className="k mono">{fmtCount(DEMO_STATS.totals.prompts)} prompts</p>
            </div>
            <div className="card card-b">
              <span className="emoji">{persona.emoji}</span>
              <p className="k">Your persona</p>
              <p className="v" style={{ fontSize: '1.9rem' }}>
                {persona.name}
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="section" aria-labelledby="how">
        <h2 id="how">Three steps, about a minute.</h2>
        <p className="section-lede">No sign-up, no API keys, nothing to connect.</p>
        <ol className="steps">
          <li>
            <h3>Run one command</h3>
            <p>
              <code className="mono">npx @vibewrap/vibe-wrapped</code> in any terminal. Pick this year, all time or a custom range.
            </p>
          </li>
          <li>
            <h3>It crunches locally</h3>
            <p>Sessions, hours, tokens, models, projects, streaks, your busiest hour and your persona, all computed on your machine.</p>
          </li>
          <li>
            <h3>Share your link</h3>
            <p>You get a link with your whole wrap packed inside it. Post it anywhere, or download the story image from the last slide.</p>
          </li>
        </ol>
      </section>

      <section className="privacy" aria-labelledby="privacy">
        <div className="section">
          <div>
            <h2 id="privacy">Your prompts never leave your laptop.</h2>
            <ul>
              <li>Logs are read on your machine. Only numbers go into your link: counts, durations, model names and your persona.</li>
              <li>Nothing is uploaded or stored. There’s no database: the site just reads your link when someone opens it.</li>
              <li>Prompt text, code, file paths and absolute folders are never sent.</li>
              <li>Project names are shown only if you say so. Otherwise they become “Project 1–5”.</li>
              <li>
                Run <code className="mono">npx @vibewrap/vibe-wrapped --dry-run</code> to print the exact JSON first. Nothing is sent.
              </li>
              <li>No accounts. Anyone with your link can see your wrap, so share it as you like.</li>
              <li>
                It’s open source, so you can read exactly what runs on your machine{' '}
                <a href={GITHUB_URL} rel="noopener">
                  on GitHub
                </a>
                .
              </li>
            </ul>
          </div>
          <div>
            <pre className="payload" tabIndex={0} aria-label="Example of the exact data inside a wrap link">
              {payloadPreview()}
            </pre>
            <p className="payload-caption">This is everything your link contains. The site ignores any other fields.</p>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="tools">
        <h2 id="tools">Works with the agents you use.</h2>
        <p className="section-lede">Use one tool or all three. Your wrap merges them into one story and skips anything you don’t have.</p>
        <div className="tools-row">
          {TOOLS.map((t) => (
            <div key={t.id} className="tool-card" style={{ background: TOOL[t.id].color }}>
              <h3>{TOOL[t.id].name}</h3>
              <p>{t.where}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section final-cta" aria-labelledby="cta">
        <h2 id="cta">Go on. See who you were this year.</h2>
        <CopyCommand />
        <p>
          <Link href="/demo">Or watch the demo first</Link>
        </p>
      </section>

      <footer className="footer">
        <nav aria-label="Legal">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
        <p>
          Open source on{' '}
          <a href={GITHUB_URL} rel="noopener">
            GitHub
          </a>
          . MIT licensed.
        </p>
        <p>Vibe Wrapped isn’t affiliated with Anthropic, OpenAI or Cursor.</p>
      </footer>
    </main>
  );
}
