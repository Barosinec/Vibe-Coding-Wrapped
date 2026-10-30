import { ogImage } from '@/lib/card';
import { loadWrap } from '@/lib/wraps';

export const runtime = 'nodejs';
export const alt = 'A Vibe Wrapped summary: persona and top stats';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stats = loadWrap(id);
  if (!stats) return new Response('Wrap not found', { status: 404 });
  return ogImage(stats);
}
