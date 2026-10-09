import type { BeerReview } from '../types';

export const MAX_TAGS_PER_REVIEW = 8;
export const MAX_TAG_LENGTH = 24;

/**
 * Trims, collapses whitespace, caps the length and capitalises each word's first letter
 * ("  dark   fruit " -> "Dark Fruit", "IPA" stays "IPA"). Returns '' if nothing usable is left.
 */
export function normalizeTag(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TAG_LENGTH)
    .trim()
    .replace(/(^|\s)(\S)/g, (_match, space: string, letter: string) => space + letter.toUpperCase());
}

/** Tags are compared case-insensitively, so "hoppy" and "Hoppy" are the same tag. */
export const tagKey = (tag: string) => normalizeTag(tag).toLowerCase();

/** Adds or removes a tag. Adding is ignored once the per-review limit is reached. */
export function toggleTag(tags: readonly string[], raw: string): string[] {
  const tag = normalizeTag(raw);
  if (!tag) return [...tags];
  if (tags.some((t) => tagKey(t) === tagKey(tag))) return tags.filter((t) => tagKey(t) !== tagKey(tag));
  if (tags.length >= MAX_TAGS_PER_REVIEW) return [...tags];
  return [...tags, tag];
}

/** Normalised, de-duplicated tags ready to store on a review, or `undefined` when there are none. */
export function cleanTags(tags: readonly string[] | undefined): string[] | undefined {
  const cleaned: string[] = [];
  (tags ?? []).forEach((raw) => {
    const tag = normalizeTag(raw);
    if (tag && cleaned.length < MAX_TAGS_PER_REVIEW && !cleaned.some((t) => tagKey(t) === tagKey(tag))) {
      cleaned.push(tag);
    }
  });
  return cleaned.length > 0 ? cleaned : undefined;
}

export interface TagCount {
  tag: string;
  count: number;
}

/**
 * The most common tags across a drink's reviews, counting each tag at most once per review.
 * A tag is shown with the spelling of its first use; ties are broken alphabetically so the order is stable.
 */
export function topTags(reviews: readonly Pick<BeerReview, 'tags'>[], limit = 3): TagCount[] {
  const counts = new Map<string, TagCount>();
  reviews.forEach((review) => {
    (cleanTags(review.tags) ?? []).forEach((tag) => {
      const entry = counts.get(tagKey(tag));
      if (entry) entry.count += 1;
      else counts.set(tagKey(tag), { tag, count: 1 });
    });
  });
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}
