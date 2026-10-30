'use client';

import { useState } from 'react';

export default function CopyCommand({ command = 'npx @vibewrap/vibe-wrapped' }: { command?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy this command', command);
    }
  };
  return (
    <div className="command">
      <code className="mono">
        <span className="dollar" aria-hidden="true">
          $
        </span>{' '}
        {command}
      </code>
      <button type="button" onClick={copy} aria-label={`Copy command: ${command}`}>
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}
