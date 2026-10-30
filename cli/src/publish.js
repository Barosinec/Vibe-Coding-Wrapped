// Turn a wrap into its share link and open it. Nothing is uploaded or stored anywhere:
// the stats travel inside the link, and the website renders them on each visit.
import { spawn } from 'node:child_process';
import { encodeWrap } from './link.js';

export const DEFAULT_SITE = 'https://vibe-wrapped-ten.vercel.app';

/** The site that renders links: VIBE_WRAPPED_SITE (for local development) or the public site. */
export function resolveSite(env = {}) {
  const base = String(env.VIBE_WRAPPED_SITE || DEFAULT_SITE).replace(/\/+$/, '');
  let u;
  try {
    u = new URL(base);
  } catch {
    throw new Error(`Invalid VIBE_WRAPPED_SITE "${base}" (expected something like ${DEFAULT_SITE})`);
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error(`Invalid VIBE_WRAPPED_SITE "${base}" (must be http or https)`);
  return base;
}

export const shareLink = (wrap, site) => `${site}/w/${encodeWrap(wrap)}`;

/** Open a URL in the default browser, detached; any failure is ignored (the link is printed anyway). */
export function openInBrowser(url, platform = process.platform, run = spawn) {
  let href;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
    href = u.href;
  } catch {
    return;
  }
  // `cmd /c start` re-parses its arguments, so skip URLs with cmd metacharacters there.
  if (platform === 'win32' && /[&^|<>"%]/.test(href)) return;
  const [cmd, args] =
    platform === 'darwin' ? ['open', [href]] : platform === 'win32' ? ['cmd', ['/c', 'start', '""', href]] : ['xdg-open', [href]];
  try {
    const child = run(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: platform === 'win32' });
    child.on('error', () => {});
    child.unref();
  } catch {
    // no browser helper available
  }
}

/**
 * Print (and open) the share link for a validated wrap.
 * @returns exit code
 */
export async function publishWrap({ wrap, opts = {}, say, stdout, env = {}, open = openInBrowser }) {
  let site;
  try {
    site = resolveSite(env);
  } catch (err) {
    say(err.message);
    return 1;
  }
  const link = shareLink(wrap, site);
  say('\nYour wrap is ready:');
  stdout.write(link + '\n');
  say('Nothing was uploaded or stored: your stats travel inside this link. Anyone you share it with can see them.');
  if (!opts.noOpen && !env.VIBE_WRAPPED_NO_OPEN) {
    try {
      open(link);
    } catch {
      // opening the browser is best effort
    }
  }
  return 0;
}
