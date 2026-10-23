import { describe, it, expect } from 'vitest';
import { 
  parseServingFormat, 
  parseDrinkType, 
  parseDrinkFlags, 
  matchesDietaryFilter 
} from './drinkFlags';

describe('drinkFlags', () => {
  describe('parseServingFormat', () => {
    it('matches valid serving formats case-insensitively', () => {
      expect(parseServingFormat('cask')).toBe('Cask');
      expect(parseServingFormat('KEG')).toBe('Keg');
      expect(parseServingFormat('Can')).toBe('Can');
      expect(parseServingFormat('bottle')).toBe('Bottle');
    });

    it('returns undefined for non-string or unknown formats', () => {
      expect(parseServingFormat(123)).toBeUndefined();
      expect(parseServingFormat(null)).toBeUndefined();
      expect(parseServingFormat('Wine')).toBeUndefined();
    });
  });

  describe('parseDrinkType', () => {
    it('prefers type over caskOrKeg', () => {
      expect(parseDrinkType({ type: 'Rotating Keg', caskOrKeg: 'Cask' })).toBe('Rotating Keg');
    });

    it('falls back to caskOrKeg when type is empty or absent', () => {
      expect(parseDrinkType({ caskOrKeg: 'Cask' })).toBe('Cask');
    });

    it('defaults to Unknown if neither is provided', () => {
      expect(parseDrinkType({})).toBe('Unknown');
    });
  });

  describe('parseDrinkFlags', () => {
    it('keeps only genuine boolean true for vegan and gluten-free', () => {
      const flags = parseDrinkFlags({
        type: 'Cask',
        isVegan: true,
        isGlutenFree: false,
      });
      expect(flags.isVegan).toBe(true);
      expect(flags.isGlutenFree).toBeUndefined();
    });
  });

  describe('matchesDietaryFilter', () => {
    it('filters correctly for vegan, gluten-free, and both', () => {
      const veganDrink = { type: 'Cask', isVegan: true };
      const gfDrink = { type: 'Cask', isGlutenFree: true };
      const bothDrink = { type: 'Cask', isVegan: true, isGlutenFree: true };
      const normalDrink = { type: 'Cask' };

      expect(matchesDietaryFilter(veganDrink, 'vegan')).toBe(true);
      expect(matchesDietaryFilter(normalDrink, 'vegan')).toBe(false);

      expect(matchesDietaryFilter(gfDrink, 'gluten-free')).toBe(true);
      expect(matchesDietaryFilter(normalDrink, 'gluten-free')).toBe(false);

      expect(matchesDietaryFilter(bothDrink, 'both')).toBe(true);
      expect(matchesDietaryFilter(veganDrink, 'both')).toBe(false);

      expect(matchesDietaryFilter(normalDrink, 'any')).toBe(true);
    });
  });
});
