export interface RatingSentiment {
  label: string;
  subtext: string;
  tier: 'low' | 'below' | 'solid' | 'great' | 'outstanding' | 'world-class';
}

export function triggerHapticTick(durationMs = 6): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(durationMs);
    } catch {
      // Ignore in restricted or unsupported environments
    }
  }
}

export function clampAndSnapRating(raw: number): number {
  if (Number.isNaN(raw)) return 8.0;
  const clamped = Math.min(10.0, Math.max(0.5, raw));
  return Math.round(clamped * 2) / 2;
}

export function getRatingSentiment(rating: number): RatingSentiment {
  if (rating <= 2.5) {
    return { label: 'Flawed / Undrinkable', subtext: 'Off-flavors or drain pour', tier: 'low' };
  }
  if (rating <= 4.5) {
    return { label: 'Below Average', subtext: 'Missing the mark', tier: 'below' };
  }
  if (rating <= 6.5) {
    return { label: 'Solid / Sessionable', subtext: 'Decent, easy drinking', tier: 'solid' };
  }
  if (rating <= 8.0) {
    return { label: 'Great / Very Good', subtext: 'Well-crafted & enjoyable', tier: 'great' };
  }
  if (rating <= 9.0) {
    return { label: 'Outstanding', subtext: 'Standout festival pour', tier: 'outstanding' };
  }
  return { label: 'World Class', subtext: 'Unforgettable masterpiece', tier: 'world-class' };
}
