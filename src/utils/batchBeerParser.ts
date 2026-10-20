import type { BeerDrink } from '../types';
import { parseDrinkFlags } from './drinkFlags';

export interface BatchParseResult {
  validDrinks: Omit<BeerDrink, 'id' | 'reviews'>[];
  skippedCount: number;
  error?: string;
}

function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

export function parseBatchBeerJson(jsonString: string): BatchParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return {
      validDrinks: [],
      skippedCount: 0,
      error: 'Invalid JSON file. Please ensure the file contains valid JSON formatting.',
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      validDrinks: [],
      skippedCount: 0,
      error: 'Invalid file format: JSON root must be an array of beer records (e.g. [ { ... } ]).',
    };
  }

  if (parsed.length === 0) {
    return {
      validDrinks: [],
      skippedCount: 0,
      error: 'The uploaded JSON file contains an empty array. No beer records were found.',
    };
  }

  const validDrinks: Omit<BeerDrink, 'id' | 'reviews'>[] = [];
  let skippedCount = 0;

  for (const item of parsed) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const record = item as Record<string, unknown>;
      const { name, brewery, location, style, description, abv, imageUrl } = record;

      if (
        isNonEmptyString(name) &&
        isNonEmptyString(brewery) &&
        isNonEmptyString(location) &&
        isNonEmptyString(style) &&
        isNonEmptyString(description)
      ) {
        let formattedAbv = '';
        if (typeof abv === 'number') {
          formattedAbv = `${abv}%`;
        } else if (typeof abv === 'string' && abv.trim()) {
          const trimmedAbv = abv.trim();
          formattedAbv = trimmedAbv.endsWith('%') ? trimmedAbv : `${trimmedAbv}%`;
        }

        if (!formattedAbv) {
          skippedCount++;
          continue;
        }

        const drink: Omit<BeerDrink, 'id' | 'reviews'> = {
          name: name.trim(),
          brewery: brewery.trim(),
          location: location.trim(),
          abv: formattedAbv,
          style: style.trim(),
          description: description.trim(),
          ...(typeof imageUrl === 'string' && imageUrl.trim()
            ? { imageUrl: imageUrl.trim() }
            : {}),
          ...parseDrinkFlags(record),
        };

        validDrinks.push(drink);
      } else {
        skippedCount++;
      }
    } else {
      skippedCount++;
    }
  }

  if (validDrinks.length === 0) {
    return {
      validDrinks: [],
      skippedCount,
      error: 'No valid beer records found in the file. Each beer object must include name, brewery, location, abv, style, and description.',
    };
  }

  return {
    validDrinks,
    skippedCount,
  };
}
