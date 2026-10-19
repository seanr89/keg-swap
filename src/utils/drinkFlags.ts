import { SERVING_FORMATS, type BeerDrink, type ServingFormat } from '../types';

export type DrinkFlags = Pick<BeerDrink, 'isVegan' | 'isGlutenFree' | 'caskOrKeg' | 'type'>;

/** Matches a serving format case-insensitively; returns `undefined` for anything else. */
export function parseServingFormat(value: unknown): ServingFormat | undefined {
  if (typeof value !== 'string') return undefined;
  const wanted = value.trim().toLowerCase();
  return SERVING_FORMATS.find((format) => format.toLowerCase() === wanted);
}

/**
 * Extracts drink type from an imported item (`type` or fallback to `caskOrKeg`).
 * If absent, empty, or unrecognised, defaults to 'Unknown'.
 */
export function parseDrinkType(item: Record<string, unknown>): string {
  if (typeof item.type === 'string' && item.type.trim()) {
    return item.type.trim();
  }
  if (typeof item.caskOrKeg === 'string' && item.caskOrKeg.trim()) {
    return item.caskOrKeg.trim();
  }
  return 'Unknown';
}

/**
 * Reads the optional dietary, type, and serving-format fields from an imported JSON row.
 * Only genuine `true` booleans and recognised formats are kept; missing type defaults to 'Unknown'.
 */
export function parseDrinkFlags(item: Record<string, unknown>): DrinkFlags {
  const type = parseDrinkType(item);
  const caskOrKeg = parseServingFormat(item.caskOrKeg) ?? parseServingFormat(type);
  return {
    type,
    ...(item.isVegan === true ? { isVegan: true } : {}),
    ...(item.isGlutenFree === true ? { isGlutenFree: true } : {}),
    ...(caskOrKeg ? { caskOrKeg } : {}),
  };
}

export type DietaryFilter = 'any' | 'vegan' | 'gluten-free' | 'both';

export function matchesDietaryFilter(drink: DrinkFlags, filter: DietaryFilter): boolean {
  if (filter === 'vegan') return drink.isVegan === true;
  if (filter === 'gluten-free') return drink.isGlutenFree === true;
  if (filter === 'both') return drink.isVegan === true && drink.isGlutenFree === true;
  return true;
}
