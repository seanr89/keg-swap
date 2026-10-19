import React from 'react';
import { Beer, CupSoda, Wine, FlaskConical, MoreHorizontal } from 'lucide-react';
import { triggerHapticTick } from '../../utils/ratingUtils';

export interface ServingFormatSelectorProps {
  servingSize: string;
  customServingSize: string;
  price: string;
  onServingSizeChange: (size: string) => void;
  onCustomServingSizeChange: (custom: string) => void;
  onPriceChange: (price: string) => void;
  disabled?: boolean;
}

interface ServingOption {
  value: string;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
}

const SERVING_OPTIONS: ServingOption[] = [
  { value: 'Pint', label: 'Pint', shortLabel: 'Pint', icon: <Beer size={15} /> },
  { value: 'Half Pint', label: 'Half Pint', shortLabel: 'Half', icon: <Beer size={13} /> },
  { value: 'Third Pint', label: 'Third Pint', shortLabel: '1/3 Pint', icon: <CupSoda size={14} /> },
  { value: 'Can', label: 'Can (330/440ml)', shortLabel: 'Can', icon: <CupSoda size={15} /> },
  { value: 'Bottle', label: 'Bottle', shortLabel: 'Bottle', icon: <Wine size={15} /> },
  { value: 'Flight / Sample', label: 'Flight / Sample', shortLabel: 'Sample', icon: <FlaskConical size={14} /> },
  { value: 'Other', label: 'Other size', shortLabel: 'Other', icon: <MoreHorizontal size={15} /> },
];

const PRICE_PRESETS = ['£3.50', '£4.50', '£5.50', '£6.50'] as const;

export const ServingFormatSelector: React.FC<ServingFormatSelectorProps> = ({
  servingSize,
  customServingSize,
  price,
  onServingSizeChange,
  onCustomServingSizeChange,
  onPriceChange,
  disabled = false,
}) => {
  const handleSelectFormat = (val: string) => {
    if (disabled) return;
    triggerHapticTick(5);
    if (servingSize === val) {
      onServingSizeChange('');
    } else {
      onServingSizeChange(val);
    }
  };

  const handlePricePresetClick = (preset: string) => {
    if (disabled) return;
    triggerHapticTick(5);
    if (price.trim() === preset) {
      onPriceChange('');
    } else {
      onPriceChange(preset);
    }
  };

  // Strip leading £ for the raw input if user uses the £ prefix box, or allow free entry
  const displayPrice = price.startsWith('£') ? price.slice(1) : price;

  const handlePriceInput = (raw: string) => {
    const cleaned = raw.trim();
    if (!cleaned) {
      onPriceChange('');
      return;
    }
    // If user typed a number without currency symbol, prefix £ automatically
    if (/^\d/.test(cleaned)) {
      onPriceChange(`£${cleaned}`);
    } else {
      onPriceChange(cleaned);
    }
  };

  return (
    <div className="review-serving-section">
      {/* Serving Format Pills */}
      <div className="form-group" style={{ marginBottom: '14px' }}>
        <div className="review-section-label-row">
          <span className="form-label" style={{ margin: 0 }}>Serving Format</span>
          <span className="review-optional-hint">Optional • 1-tap</span>
        </div>

        <div className="serving-format-pills" role="group" aria-label="Serving format">
          {SERVING_OPTIONS.map((opt) => {
            const isSelected = servingSize === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                className={`serving-format-pill ${isSelected ? 'selected' : ''}`}
                aria-pressed={isSelected}
                aria-label={opt.label}
                disabled={disabled}
                onClick={() => handleSelectFormat(opt.value)}
              >
                {opt.icon}
                <span>{opt.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {servingSize === 'Other' && (
          <div className="custom-serving-input-wrap">
            <input
              type="text"
              id="rev-custom-size"
              className="form-input mobile-touch-input"
              placeholder="e.g. 2/3 Schooner or 75cl Bottle"
              aria-label="Custom serving size"
              value={customServingSize}
              disabled={disabled}
              onChange={(e) => onCustomServingSizeChange(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Price Input & Quick Token / Price Pills */}
      <div className="form-group" style={{ marginBottom: 0 }}>
        <div className="review-section-label-row">
          <label htmlFor="rev-price-input" className="form-label" style={{ margin: 0 }}>
            Price Paid
          </label>
          <span className="review-optional-hint">Optional</span>
        </div>

        <div className="price-control-row">
          <div className="price-input-shell">
            <span className="price-currency-prefix" aria-hidden="true">£</span>
            <input
              type="text"
              id="rev-price-input"
              inputMode="decimal"
              className="form-input price-decimal-input"
              placeholder="0.00"
              value={displayPrice}
              disabled={disabled}
              onChange={(e) => handlePriceInput(e.target.value)}
            />
          </div>

          <div className="price-preset-pills" role="group" aria-label="Quick price presets">
            {PRICE_PRESETS.map((preset) => {
              const isSelected = price.trim() === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  className={`price-preset-pill ${isSelected ? 'selected' : ''}`}
                  aria-pressed={isSelected}
                  disabled={disabled}
                  onClick={() => handlePricePresetClick(preset)}
                >
                  {preset}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
