import React, { useEffect, useRef, useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import { shareLink, type ShareContent } from '../utils/shareUtils';

interface ShareButtonProps extends ShareContent {
  /** Accessible name for the idle state, e.g. "Share Leeds Beer Fest". */
  label: string;
  showLabel?: boolean;
  className?: string;
}

const FEEDBACK_MS = 2000;

/** Icon button that shares a link and briefly confirms when it was copied instead. */
export const ShareButton: React.FC<ShareButtonProps> = ({ label, showLabel = false, className = '', ...content }) => {
  const [feedback, setFeedback] = useState<'copied' | 'failed' | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const result = await shareLink(content);
    if (result !== 'copied' && result !== 'failed') return;
    setFeedback(result);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setFeedback(null), FEEDBACK_MS);
  };

  const currentLabel =
    feedback === 'copied' ? 'Link copied' : feedback === 'failed' ? "Couldn't copy link" : label;

  return (
    <button
      type="button"
      className={`share-btn ${className}`.trim()}
      onClick={handleClick}
      aria-label={currentLabel}
      title={currentLabel}
    >
      {feedback === 'copied' ? <Check size={15} /> : <Share2 size={15} />}
      {showLabel && <span>{feedback ? currentLabel : 'Share'}</span>}
      <span className="sr-only" role="status" aria-live="polite">{feedback ? currentLabel : ''}</span>
    </button>
  );
};
