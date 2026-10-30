import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Privacy', description: 'How Vibe Wrapped handles your data: nothing is uploaded or stored.' };

const REPO = 'https://github.com/Barosinec/Vibe-Coding-Wrapped';

export default function Privacy() {
  return (
    <main className="legal">
      <Link href="/" className="mono brand">
        vibe wrapped
      </Link>
      <h1>Privacy</h1>
      <p className="updated">Last updated: October 30, 2026</p>

      <p>
        Vibe Wrapped is a free, open-source hobby project by Sebastian Barosinec. It’s built so that there is almost nothing to say here: no
        accounts, no database, no cookies, no analytics and no trackers.
      </p>

      <h2>The command-line tool</h2>
      <p>
        <code className="mono">npx @vibewrap/vibe-wrapped</code> runs on your computer. It reads your Claude Code, Codex and Cursor history
        there and computes your stats there. Your prompts, code, file contents and full file paths never leave your machine. The tool does not
        send anything anywhere and writes no files; it only prints a link and, unless you pass <code className="mono">--no-open</code>, opens
        it in your browser.
      </p>

      <h2>What a wrap link contains</h2>
      <p>
        A wrap link carries your stats inside it, compressed: counts, durations, token totals, model names, an activity heatmap, the display
        name you chose and, unless you hid them, the folder names of your top 5 projects. Run{' '}
        <code className="mono">npx @vibewrap/vibe-wrapped --dry-run</code> to see exactly what goes into your link before you share it.
      </p>
      <p>
        Anyone who has your link can see your wrap. The data is in the link itself, so a link you’ve shared can’t be taken back or deleted by
        us. Share it the way you would share a screenshot.
      </p>

      <h2>What happens when a link is opened</h2>
      <p>
        When someone opens a wrap link, their browser sends it to this website, which decodes the stats only to draw the page and its images.
        This website doesn’t save the link or the stats anywhere.
      </p>
      <p>
        The site is hosted by Vercel Inc. Like any web host, Vercel processes technical request data, such as IP addresses, the requested URL
        (which includes the wrap link) and browser information, to deliver the site and keep it secure, and may keep standard logs for a
        limited time under its own policies. See{' '}
        <a href="https://vercel.com/legal/privacy-policy" rel="noopener">
          Vercel’s privacy policy
        </a>
        . We rely on our legitimate interest in running the site (Art. 6(1)(f) GDPR) for this.
      </p>
      <p>
        Fonts are served from this website itself. To draw emoji in the share images, the server downloads public emoji artwork from a CDN;
        no visitor data is part of those requests.
      </p>

      <h2>Your rights</h2>
      <p>
        Because we store nothing, there is no personal data of yours that we could show, correct or delete. If you have a question or a
        request, for example about hosting logs, open an issue on{' '}
        <a href={`${REPO}/issues`} rel="noopener">
          GitHub
        </a>
        . If you are in the EU or EEA, you can also lodge a complaint with your local data protection authority.
      </p>

      <h2>Changes</h2>
      <p>
        If this page changes, the new version will be published here and in the{' '}
        <a href={REPO} rel="noopener">
          source code
        </a>
        .
      </p>

      <p className="legal-nav">
        <Link href="/terms">Terms</Link> · <Link href="/">Home</Link>
      </p>
    </main>
  );
}
