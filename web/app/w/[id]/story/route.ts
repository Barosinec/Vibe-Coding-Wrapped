import { storyImage } from '@/lib/card';
import { loadWrap } from '@/lib/wraps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The 1080×1920 story PNG, downloaded from the summary slide. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stats = loadWrap(id);
  if (!stats) return new Response('Wrap not found', { status: 404 });
  return storyImage(stats, `vibe-wrapped-${id}.png`);
}
