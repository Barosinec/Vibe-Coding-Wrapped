import { fileURLToPath } from 'node:url';

// npm workspaces hoist dependencies to the repo root, one level above this app.
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

// Read from disk at runtime by lib/card.tsx, so the file tracer cannot find them on its own.
const cardFonts = [
  '../node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-600-normal.woff',
  '../node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff',
  '../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff',
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@vibewrap/vibe-wrapped'],
  poweredByHeader: false,
  outputFileTracingRoot: repoRoot,
  // Keys are globs matched against the route, so the brackets of [id] must be escaped.
  outputFileTracingIncludes: {
    '/w/\\[id\\]/opengraph-image': cardFonts,
    '/w/\\[id\\]/story': cardFonts,
  },
};

export default nextConfig;
