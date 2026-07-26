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

  const handleMouseMove = (glassIndex: number, e: React.MouseEvent<HTMLButtonElement>) => {
    if (!interactive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isHalf = x < rect.width / 2;
    const val = isHalf ? glassIndex + 0.5 : glassIndex + 1;
    setHoverRating(val);
  };

  const handleClick = (glassIndex: number, e: React.MouseEvent<HTMLButtonElement>) => {
    if (!interactive || !onChange) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isHalf = x < rect.width / 2;
    const val = isHalf ? glassIndex + 0.5 : glassIndex + 1;
    onChange(val);
  };

  const renderBeerGlassIcon = (isFull: boolean, isHalf: boolean) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={isFull || isHalf ? 'star-filled' : 'star-empty'}
    >
      <path
        d="M5 8v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8H5z"
        fill={isFull ? 'currentColor' : isHalf ? `url(#star-half-grad-${gradientId})` : 'none'}
      />
      <path
        d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2.5 11 2.5s2 .5 3 .5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.57-.5-2.5-.5Z"
        fill={isFull ? 'currentColor' : isHalf ? `url(#star-half-grad-${gradientId})` : 'none'}
      />
      <path d="M17 11h1a3 3 0 0 1 0 6h-1" fill="none" />
      <path d="M9 12v6" strokeOpacity="0.6" />
      <path d="M13 12v6" strokeOpacity="0.6" />
    </svg>
  );

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
          const glassVal = i + 1;
          const isFull = currentRating >= glassVal;
          const isHalf = !isFull && currentRating >= glassVal - 0.5;

          if (interactive) {
            return (
              <button
                key={i}
                type="button"
                className={`star-btn-item ${isFull ? 'filled' : isHalf ? 'half' : 'empty'}`}
                onMouseMove={(e) => handleMouseMove(i, e)}
                onClick={(e) => handleClick(i, e)}
                aria-label={`Rate ${glassVal - 0.5} or ${glassVal} beer glasses`}
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
                {renderBeerGlassIcon(isFull, isHalf)}
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
              {renderBeerGlassIcon(isFull, isHalf)}
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
