import React, { useRef, useEffect } from 'react';
import { MessageSquarePlus, X } from 'lucide-react';
import { triggerHapticTick } from '../../utils/ratingUtils';

export interface TastingNotesInputProps {
  comment: string;
  onChange: (comment: string) => void;
  disabled?: boolean;
}

const MAX_NOTES_LENGTH = 600;

const QUICK_IMPRESSIONS = [
  'Juicy & tropical',
  'Crisp, clean finish',
  'Heavy roasty bitterness',
  'Smooth creamy mouthfeel',
  'Pleasant tart acidity',
  'Balanced malt & hops',
] as const;

export const TastingNotesInput: React.FC<TastingNotesInputProps> = ({
  comment,
  onChange,
  disabled = false,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fallback auto-resize for browsers without CSS `field-sizing: content`
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(72, Math.min(220, el.scrollHeight))}px`;
  }, [comment]);

  const isImpressionIncluded = (phrase: string): boolean =>
    comment.toLowerCase().includes(phrase.toLowerCase());

  const handleToggleImpression = (phrase: string) => {
    if (disabled) return;
    triggerHapticTick(5);

    const trimmed = comment.trim();
    if (!trimmed) {
      onChange(`${phrase}.`);
      return;
    }

    if (isImpressionIncluded(phrase)) {
      // Remove the phrase if already present
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|\\s|•\\s*)${escaped}[.,;]?`, 'i');
      const next = trimmed.replace(regex, '').replace(/^\s*[•.,;]\s*/, '').trim();
      onChange(next);
      return;
    }

    const separator = /[.!?]$/.test(trimmed) ? ' ' : '. ';
    const next = `${trimmed}${separator}${phrase}.`;
    if (next.length <= MAX_NOTES_LENGTH) {
      onChange(next);
    }
  };

  return (
    <div className="form-group tasting-notes-group" style={{ margin: 0 }}>
      <div className="review-section-label-row">
        <label htmlFor="rev-comment" className="form-label" style={{ margin: 0 }}>
          Tasting Notes
        </label>
        <div className="notes-meta-actions">
          {comment.length > 0 && (
            <button
              type="button"
              className="btn-clear-notes"
              onClick={() => onChange('')}
              disabled={disabled}
              title="Clear notes"
            >
              <X size={12} />
              <span>Clear</span>
            </button>
          )}
          <span className="review-optional-hint">
            {comment.length > 0 ? `${comment.length}/${MAX_NOTES_LENGTH}` : 'Optional • 1-tap or type'}
          </span>
        </div>
      </div>

      {/* 1-Tap Quick Impressions Bar */}
      <div className="quick-impressions-row" role="group" aria-label="One-tap tasting impressions">
        {QUICK_IMPRESSIONS.map((phrase) => {
          const active = isImpressionIncluded(phrase);
          return (
            <button
              key={phrase}
              type="button"
              className={`quick-impression-chip ${active ? 'active' : ''}`}
              aria-pressed={active}
              disabled={disabled}
              onClick={() => handleToggleImpression(phrase)}
            >
              <MessageSquarePlus size={12} />
              <span>{phrase}</span>
            </button>
          );
        })}
      </div>

      <textarea
        ref={textareaRef}
        id="rev-comment"
        className="form-input review-textarea-mobile"
        placeholder="Tap an impression above or describe aroma, body, finish..."
        maxLength={MAX_NOTES_LENGTH}
        value={comment}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
      />
    </div>
  );
};
