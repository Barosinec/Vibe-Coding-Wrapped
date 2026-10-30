import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Terms', description: 'Terms of use for Vibe Wrapped.' };

const REPO = 'https://github.com/Barosinec/Vibe-Coding-Wrapped';

export default function Terms() {
  return (
    <main className="legal">
      <Link href="/" className="mono brand">
        vibe wrapped
      </Link>
      <h1>Terms</h1>
      <p className="updated">Last updated: October 30, 2026</p>

      <p>
        Vibe Wrapped (this website and the <code className="mono">@vibewrap/vibe-wrapped</code> command-line tool) is a free, open-source hobby
        project by Sebastian Barosinec. By using it you agree to these terms.
      </p>

      <h2>Free and as-is</h2>
      <p>
        Vibe Wrapped is provided “as is”, without warranty of any kind. Stats are estimates computed from local log files and may be
        incomplete or inaccurate. The service may change, break or be discontinued at any time, and wrap links may stop working.
      </p>

      <h2>Your content and your links</h2>
      <p>
        You decide what goes into your wrap and whom you share its link with. Don’t put anything into a wrap (for example a display name) that
        you don’t have the right to share, and don’t use the site to harass anyone, to break the law, or to disrupt or overload the service.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent permitted by law, the author is not liable for any damages arising from using Vibe Wrapped. Nothing in these terms
        limits rights you have under mandatory consumer protection law.
      </p>

      <h2>Open source and trademarks</h2>
      <p>
        The source code is available under the{' '}
        <a href={`${REPO}/blob/main/LICENSE`} rel="noopener">
          MIT License
        </a>
        . Vibe Wrapped isn’t affiliated with or endorsed by Anthropic, OpenAI, Cursor or Spotify; their product names are used only to
        describe compatibility.
      </p>

      <h2>Contact</h2>
      <p>
        Questions? Open an issue on{' '}
        <a href={`${REPO}/issues`} rel="noopener">
          GitHub
        </a>
        .
      </p>

      <p className="legal-nav">
        <Link href="/privacy">Privacy</Link> · <Link href="/">Home</Link>
      </p>
    </main>
  );
}
