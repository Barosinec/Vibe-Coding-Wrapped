import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { personaById } from '@vibewrap/vibe-wrapped/personas';
import WrapStory from '@/components/WrapStory';
import { fmtCount, fmtHours } from '@/lib/format';
import { loadWrap } from '@/lib/wraps';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const s = loadWrap(id);
  if (!s) return { title: 'Wrap not found' };
  const persona = personaById(s.persona.id);
  const h = fmtHours(s.totals.activeMinutes);
  const title = `${s.displayName ? `${s.displayName}’s ` : ''}${s.range.label} Vibe Wrapped`;
  const description = `${persona ? `${persona.emoji} ${persona.name}. ` : ''}${h.value} ${h.unit} with AI, ${fmtCount(s.totals.prompts)} prompts.`;
  return { title, description, openGraph: { title, description }, twitter: { card: 'summary_large_image', title, description } };
}

export default async function WrapPage({ params }: Props) {
  const { id } = await params;
  const stats = loadWrap(id);
  if (!stats) notFound();
  return <WrapStory stats={stats} storyUrl={`/w/${id}/story`} />;
}
