'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { WrapStats } from '@vibewrap/vibe-wrapped/schema';
import { availableSlides } from '@/lib/slides';
import { SLIDES, Summary, slideTheme } from './slides';

const SLIDE_MS = 7000;

export default function WrapStory({ stats, storyUrl }: { stats: WrapStats; storyUrl: string }) {
  const slides = useMemo(() => availableSlides(stats), [stats]);
  const [index, setIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [paused, setPaused] = useState(false);
  const [copied, setCopied] = useState(false);
  const swipe = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const last = slides.length - 1;
  const id = slides[index];

  const go = useCallback((delta: number) => setIndex((i) => Math.max(0, Math.min(last, i + delta))), [last]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autoplay') === '0' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) setAutoplay(false);
    const start = Number(params.get('slide'));
    if (Number.isInteger(start) && start > 0) setIndex(Math.min(last, start - 1));
  }, [last]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('button, a, input')) {
        if (e.key === ' ' || e.key === 'Enter') return;
      }
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        go(-1);
      } else if (e.key === 'Home') setIndex(0);
      else if (e.key === 'End') setIndex(last);
    };
    const onVisibility = () => setPaused(document.hidden);
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [go, last]);

  // The last slide's bar fills too; reaching its end simply stays on the summary.
  const running = autoplay && !paused;

  const onPointerDown = (e: React.PointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY, moved: false };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start || (e.target as HTMLElement).closest('[data-no-nav], button, a')) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) return go(dx < 0 ? 1 : -1); // swipe
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) return; // a drag, not a tap
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    go(e.clientX - rect.left < rect.width * 0.3 ? -1 : 1);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + window.location.pathname);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link', window.location.origin + window.location.pathname);
    }
  };

  const theme = slideTheme(id, stats);
  const Slide = id === 'summary' ? null : SLIDES[id];

  return (
    <main className="story-stage" style={{ '--stage-bg': theme.bg } as CSSProperties}>
      <div className="stage-blur" aria-hidden="true" />
      <section
        className={`story ink-${theme.ink}`}
        style={{ background: theme.bg }}
        aria-roledescription="carousel"
        aria-label="Your Vibe Wrapped"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        data-slide={id}
        data-index={index}
      >
        <div className="progress" aria-hidden="true">
          {slides.map((sid, i) => (
            <span key={sid} className="progress-track">
              <span
                key={i === index ? `${sid}-${index}` : sid}
                className={`progress-fill ${i < index ? 'done' : i === index ? (running ? 'running' : 'done') : ''}`}
                data-state={i < index ? 'done' : i === index ? (running ? 'running' : 'done') : 'todo'}
                style={{ animationDuration: `${SLIDE_MS}ms`, animationPlayState: running ? 'running' : 'paused' }}
                onAnimationEnd={() => i === index && go(1)}
              />
            </span>
          ))}
        </div>
        <div className="story-top" data-no-nav>
          <a href="/" className="brand mono">
            vibe wrapped
          </a>
          {autoplay && index < last && (
            <button type="button" className="icon-btn" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Play' : 'Pause'}>
              {paused ? '▶' : '❚❚'}
            </button>
          )}
        </div>
        <div className="slide" key={id} aria-live="polite" aria-atomic="true">
          <p className="sr-only">
            Slide {index + 1} of {slides.length}
          </p>
          {Slide ? <Slide s={stats} active /> : <Summary s={stats} active storyUrl={storyUrl} onCopy={copy} copied={copied} />}
        </div>
        <div className="nav-buttons" data-no-nav>
          <button type="button" className="icon-btn" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous slide">
            ←
          </button>
          <span className="mono counter">
            {index + 1}/{slides.length}
          </span>
          <button type="button" className="icon-btn" onClick={() => go(1)} disabled={index === last} aria-label="Next slide">
            →
          </button>
        </div>
      </section>
    </main>
  );
}
