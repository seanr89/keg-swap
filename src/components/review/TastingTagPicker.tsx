import React, { useState } from 'react';
import { Check, Plus, Sparkles } from 'lucide-react';
import { TASTING_TAGS } from '../../types';
import {
  MAX_TAG_LENGTH,
  MAX_TAGS_PER_REVIEW,
  normalizeTag,
  tagKey,
  toggleTag,
} from '../../utils/tastingTags';
import { triggerHapticTick } from '../../utils/ratingUtils';

export interface TastingTagPickerProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}

type TagCategory = 'all' | 'hops' | 'malt' | 'yeast';

const TAG_CATEGORIES: { id: TagCategory; label: string; tags: readonly string[] }[] = [
  {
    id: 'all',
    label: 'All',
    tags: TASTING_TAGS,
  },
  {
    id: 'hops',
    label: 'Hops & Fruit',
    tags: ['Hoppy', 'Citrus', 'Tropical', 'Piney', 'Fruity'],
  },
  {
    id: 'malt',
    label: 'Malt & Dark',
    tags: ['Malty', 'Roasty', 'Chocolate', 'Coffee', 'Caramel', 'Smoky'],
  },
  {
    id: 'yeast',
    label: 'Body & Finish',
    tags: ['Crisp', 'Hazy', 'Sour', 'Bitter', 'Sweet'],
  },
];

export const TastingTagPicker: React.FC<TastingTagPickerProps> = ({
  selectedTags,
  onChange,
  disabled = false,
}) => {
  const [activeCategory, setActiveCategory] = useState<TagCategory>('all');
  const [customTagInput, setCustomTagInput] = useState('');

  const isAtLimit = selectedTags.length >= MAX_TAGS_PER_REVIEW;

  // Custom tags added by user that aren't in the default preset list
  const customTags = selectedTags.filter(
    (t) => !TASTING_TAGS.some((preset) => tagKey(preset) === tagKey(t))
  );

  const currentPresetTags =
    TAG_CATEGORIES.find((cat) => cat.id === activeCategory)?.tags ?? TASTING_TAGS;

  const visibleTags = [
    ...currentPresetTags,
    ...customTags.filter((ct) => !currentPresetTags.some((p) => tagKey(p) === tagKey(ct))),
  ];

  const handleToggleTag = (tag: string) => {
    if (disabled) return;
    triggerHapticTick(5);
    onChange(toggleTag(selectedTags, tag));
  };

  const handleAddCustomTag = () => {
    if (disabled) return;
    const normalized = normalizeTag(customTagInput);
    if (!normalized) return;
    triggerHapticTick(6);
    if (!selectedTags.some((t) => tagKey(t) === tagKey(normalized))) {
      onChange(toggleTag(selectedTags, normalized));
    }
    setCustomTagInput('');
  };

  return (
    <fieldset className="form-group tag-picker-mobile" style={{ margin: 0 }}>
      <div className="review-section-label-row" style={{ marginBottom: '8px' }}>
        <legend className="form-label" style={{ margin: 0, padding: 0 }}>
          Flavor Profile Tags
        </legend>
        <span className={`tag-counter-badge ${isAtLimit ? 'limit-reached' : ''}`}>
          {selectedTags.length} / {MAX_TAGS_PER_REVIEW} selected
        </span>
      </div>

      {/* Sensory Category Filter Tabs */}
      <div className="tag-category-tabs" role="tablist" aria-label="Flavor tag categories">
        {TAG_CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`tag-category-tab ${isActive ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Tag Chips Cloud */}
      <div className="tag-chip-list mobile-tag-cloud">
        {visibleTags.map((tag) => {
          const selected = selectedTags.some((t) => tagKey(t) === tagKey(tag));
          const isCustom = !TASTING_TAGS.some((preset) => tagKey(preset) === tagKey(tag));
          return (
            <button
              key={tag}
              type="button"
              className={`tag-chip mobile-tag-chip ${selected ? 'selected' : ''} ${isCustom ? 'custom' : ''}`}
              aria-pressed={selected}
              disabled={disabled || (!selected && isAtLimit)}
              onClick={() => handleToggleTag(tag)}
            >
              {selected ? <Check size={13} /> : isCustom ? <Sparkles size={12} /> : null}
              <span>{tag}</span>
            </button>
          );
        })}
      </div>

      {/* Quick Custom Tag Input */}
      <div className="tag-custom-row">
        <input
          type="text"
          id="rev-custom-tag"
          className="form-input mobile-touch-input"
          aria-label="Add your own flavor tag"
          placeholder={isAtLimit ? 'Max 8 tags reached' : 'Custom tag, e.g. Stone Fruit'}
          maxLength={MAX_TAG_LENGTH}
          enterKeyHint="done"
          value={customTagInput}
          onChange={(e) => setCustomTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              handleAddCustomTag();
            }
          }}
          disabled={disabled || isAtLimit}
        />
        <button
          type="button"
          className="btn-secondary btn-add-tag"
          onClick={handleAddCustomTag}
          disabled={disabled || !customTagInput.trim() || isAtLimit}
        >
          <Plus size={15} />
          <span>Add</span>
        </button>
      </div>
    </fieldset>
  );
};
