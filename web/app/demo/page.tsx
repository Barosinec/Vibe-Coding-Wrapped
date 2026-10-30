import type { Metadata } from 'next';
import WrapStory from '@/components/WrapStory';
import { DEMO_STATS } from '@/lib/demo';

export const metadata: Metadata = {
  title: 'Demo wrap',
  description: 'A sample Vibe Wrapped: a year of vibe coding with Claude Code, Codex and Cursor.',
  openGraph: { images: ['/w/demo/opengraph-image'] },
};

export default function DemoPage() {
  return <WrapStory stats={DEMO_STATS} storyUrl="/w/demo/story" />;
}
