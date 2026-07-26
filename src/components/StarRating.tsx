import React, { useState, useId } from 'react';

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: number;
  interactive?: boolean;
  onChange?: (val: number) => void;
  showValueText?: boolean;
  className?: string;
}

export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  maxStars = 10,
  size = 18,
  interactive = false,
  onChange,
  showValueText = false,
  className = '',
}) => {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const rawGradientId = useId();
  // Sanitize useId string for valid SVG ID (remove colons)
  const gradientId = rawGradientId.replace(/:/g, '');

  const currentRating = hoverRating !== null ? hoverRating : rating;

  const handleMouseMove = (starIndex: number, e: React.MouseEvent<HTMLButtonElement>) => {
    if (!interactive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isHalf = x < rect.width / 2;
    const val = isHalf ? starIndex + 0.5 : starIndex + 1;
    setHoverRating(val);
  };

  const handleClick = (starIndex: number, e: React.MouseEvent<HTMLButtonElement>) => {
    if (!interactive || !onChange) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isHalf = x < rect.width / 2;
    const val = isHalf ? starIndex + 0.5 : starIndex + 1;
    onChange(val);
  };

  return (
    <div className={`star-rating-container ${interactive ? 'interactive' : ''} ${className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none', width: 0, height: 0 }}>
        <defs>
          <linearGradient id={`star-half-grad-${gradientId}`}>
            <stop offset="50%" stopColor="currentColor" />
            <stop offset="50%" stopColor="transparent" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      
      <div 
        className="star-rating-stars"
        onMouseLeave={() => interactive && setHoverRating(null)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}
      >
        {Array.from({ length: maxStars }, (_, i) => {
          const starVal = i + 1;
          const isFull = currentRating >= starVal;
          const isHalf = !isFull && currentRating >= starVal - 0.5;

          if (interactive) {
            return (
              <button
                key={i}
                type="button"
                className={`star-btn-item ${isFull ? 'filled' : isHalf ? 'half' : 'empty'}`}
                onMouseMove={(e) => handleMouseMove(i, e)}
                onClick={(e) => handleClick(i, e)}
                aria-label={`Rate ${starVal - 0.5} or ${starVal}`}
                style={{
                  width: size,
                  height: size,
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 0.15s ease'
                }}
              >
                <svg
                  width={size}
                  height={size}
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={isFull || isHalf ? 'star-filled' : 'star-empty'}
                >
                  <polygon
                    points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                    fill={isFull ? 'currentColor' : isHalf ? `url(#star-half-grad-${gradientId})` : 'none'}
                  />
                </svg>
              </button>
            );
          }

          return (
            <span
              key={i}
              className={`star-static-item ${isFull ? 'filled' : isHalf ? 'half' : 'empty'}`}
              style={{
                width: size,
                height: size,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={isFull || isHalf ? 'star-filled' : 'star-empty'}
              >
                <polygon
                  points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                  fill={isFull ? 'currentColor' : isHalf ? `url(#star-half-grad-${gradientId})` : 'none'}
                />
              </svg>
            </span>
          );
        })}
      </div>

      {showValueText && (
        <span className="star-rating-val-text" style={{ fontWeight: 600, fontSize: '14px' }}>
          {currentRating.toFixed(1)} / {maxStars}
        </span>
      )}
    </div>
  );
};
