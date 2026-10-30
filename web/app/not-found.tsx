import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="notfound">
      <p className="mono">404</p>
      <h1>This wrap has been unwrapped.</h1>
      <p>It was deleted, or the link has a typo.</p>
      <Link className="btn primary" href="/">
        Make your own wrap
      </Link>
    </main>
  );
}
