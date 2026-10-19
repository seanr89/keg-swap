import React, { useRef, useState, useId } from 'react';
import { Minus, Plus, Sparkles } from 'lucide-react';
import {
  clampAndSnapRating,
  getRatingSentiment,
  triggerHapticTick,
} from '../../utils/ratingUtils';

export interface RatingScrubberProps {
  rating: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}

const QUICK_PRESETS = [5.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 10.0] as const;

export const RatingScrubber: React.FC<RatingScrubberProps> = ({
  rating,
  onChange,
  disabled = false,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const clipId = useId().replace(/:/g, '');

  const normalizedRating = clampAndSnapRating(rating);
  const sentiment = getRatingSentiment(normalizedRating);
  // Map [0.5, 10.0] to [0%, 100%]
  const fillPercent = ((normalizedRating - 0.5) / 9.5) * 100;
  const glassFillHeight = (normalizedRating / 10) * 14; // SVG mug body height is 14 (from y=7 to y=21)
  const glassFillY = 21 - glassFillHeight;

  const updateRating = (nextVal: number) => {
    if (disabled) return;
    const snapped = clampAndSnapRating(nextVal);
    if (snapped !== normalizedRating) {
      triggerHapticTick(6);
      onChange(snapped);
    }
  };

  const getRatingFromPointer = (clientX: number): number => {
    const track = trackRef.current;
    if (!track) return normalizedRating;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return normalizedRating;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return clampAndSnapRating(0.5 + ratio * 9.5);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    updateRating(getRatingFromPointer(e.clientX));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || disabled) return;
    updateRating(getRatingFromPointer(e.clientX));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsDragging(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault();
        updateRating(normalizedRating + 0.5);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault();
        updateRating(normalizedRating - 0.5);
        break;
      case 'PageUp':
        e.preventDefault();
        updateRating(normalizedRating + 1.0);
        break;
      case 'PageDown':
        e.preventDefault();
        updateRating(normalizedRating - 1.0);
        break;
      case 'Home':
        e.preventDefault();
        updateRating(0.5);
        break;
      case 'End':
        e.preventDefault();
        updateRating(10.0);
        break;
      default:
        break;
    }
  };

  return (
    <div className={`rating-scrubber-card tier-${sentiment.tier}`}>
      {/* Top Display: Dynamic Mug + Sentiment Label + Large Score Badge */}
      <div className="rating-scrubber-header">
        <div className="rating-sentiment-group">
          <div className="rating-mug-visual" aria-hidden="true">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <defs>
                <clipPath id={`mug-clip-${clipId}`}>
                  <path d="M5 8v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8H5z" />
                </clipPath>
              </defs>
              {/* Liquid Fill */}
              <rect
                x="4"
                y={glassFillY}
                width="14"
                height={glassFillHeight + 2}
                clipPath={`url(#mug-clip-${clipId})`}
                className="rating-mug-liquid"
              />
              {/* Foam Top */}
              <path
                d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2.5 11 2.5s2 .5 3 .5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.57-.5-2.5-.5Z"
                className="rating-mug-foam"
              />
              {/* Glass Outline */}
              <path
                d="M5 8v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8H5z"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M17 11h1a3 3 0 0 1 0 6h-1"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="rating-sentiment-text">
            <span className="rating-sentiment-label">
              {sentiment.tier === 'world-class' && <Sparkles size={14} className="sparkle-icon" />}
              {sentiment.label}
            </span>
            <span className="rating-sentiment-subtext">{sentiment.subtext}</span>
          </div>
        </div>

        <div className="rating-score-pill" aria-live="polite">
          <span className="rating-score-number">{normalizedRating.toFixed(1)}</span>
          <span className="rating-score-max">/10</span>
        </div>
      </div>

      {/* Main Touch Scrubber Row */}
      <div className="rating-scrubber-controls">
        <button
          type="button"
          className="btn-scrubber-step"
          onClick={() => updateRating(normalizedRating - 0.5)}
          disabled={disabled || normalizedRating <= 0.5}
          aria-label="Decrease rating by 0.5"
          title="Decrease rating by 0.5"
        >
          <Minus size={18} />
        </button>

        <div
          ref={trackRef}
          role="slider"
          aria-label="Beer rating"
          aria-valuemin={0.5}
          aria-valuemax={10.0}
          aria-valuenow={normalizedRating}
          aria-valuetext={`${normalizedRating.toFixed(1)} out of 10, ${sentiment.label}`}
          tabIndex={disabled ? -1 : 0}
          className={`rating-scrubber-track-hitarea ${isDragging ? 'dragging' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={handleKeyDown}
        >
          <div className="rating-scrubber-track">
            <div
              className="rating-scrubber-fill"
              style={{ width: `${fillPercent}%` }}
            />
            {/* Subtle tick marks for 2, 4, 6, 8 */}
            <div className="rating-scrubber-ticks" aria-hidden="true">
              {[2, 4, 6, 8].map((tick) => (
                <span
                  key={tick}
                  className="scrubber-tick"
                  style={{ left: `${((tick - 0.5) / 9.5) * 100}%` }}
                />
              ))}
            </div>
            <div
              className="rating-scrubber-thumb"
              style={{ left: `${fillPercent}%` }}
            >
              <span className="scrubber-thumb-inner" />
            </div>
          </div>
        </div>

        <button
          type="button"
          className="btn-scrubber-step"
          onClick={() => updateRating(normalizedRating + 0.5)}
          disabled={disabled || normalizedRating >= 10.0}
          aria-label="Increase rating by 0.5"
          title="Increase rating by 0.5"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Quick Preset Pills */}
      <div className="rating-presets-row" role="group" aria-label="Quick rating presets">
        {QUICK_PRESETS.map((preset) => {
          const isActive = Math.abs(normalizedRating - preset) < 0.01;
          return (
            <button
              key={preset}
              type="button"
              className={`rating-preset-pill ${isActive ? 'active' : ''}`}
              aria-pressed={isActive}
              disabled={disabled}
              onClick={() => updateRating(preset)}
            >
              {preset === 10.0 ? '10' : preset.toFixed(1)}
            </button>
          );
        })}
      </div>
    </div>
  );
};
