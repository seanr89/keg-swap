import { SERVING_FORMATS, type BeerDrink, type ServingFormat } from '../types';

export type DrinkFlags = Pick<BeerDrink, 'isVegan' | 'isGlutenFree' | 'caskOrKeg'>;

/** Matches a serving format case-insensitively; returns `undefined` for anything else. */
export function parseServingFormat(value: unknown): ServingFormat | undefined {
  if (typeof value !== 'string') return undefined;
  const wanted = value.trim().toLowerCase();
  return SERVING_FORMATS.find((format) => format.toLowerCase() === wanted);
}

/**
 * Reads the optional dietary and serving-format fields from an imported JSON row.
 * Only genuine `true` booleans and recognised formats are kept; anything else is dropped
 * so that an unset flag stays "unknown" instead of becoming `false`.
 */
export function parseDrinkFlags(item: Record<string, unknown>): DrinkFlags {
  const caskOrKeg = parseServingFormat(item.caskOrKeg);
  return {
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
