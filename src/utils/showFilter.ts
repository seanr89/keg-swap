import type { BeerDrink } from '../types';

export type ShowFilter = 'all' | 'tried' | 'wishlist' | 'top5';

type FilterableDrink = Pick<BeerDrink, 'id' | 'reviews'>;

const EMPTY_SET: ReadonlySet<string> = new Set<string>();

/** A drink is "tried" when the signed-in user has reviewed it. Reviews without a `userId` never count. */
export function isTried(drink: Pick<BeerDrink, 'reviews'>, uid: string): boolean {
  return (drink.reviews ?? []).some((review) => review.userId === uid);
}

export function matchesShowFilter(
  drink: FilterableDrink,
  filter: ShowFilter,
  uid: string,
  wishlist: ReadonlySet<string>,
  topFive: ReadonlySet<string> = EMPTY_SET
): boolean {
  if (filter === 'tried') return isTried(drink, uid);
  if (filter === 'wishlist') return wishlist.has(drink.id);
  if (filter === 'top5') return topFive.has(drink.id);
  return true;
}

/** Counts over the drinks that exist, so wishlist or Top 5 ids for removed drinks are ignored. */
export function countMatching(
  drinks: readonly FilterableDrink[],
  filter: ShowFilter,
  uid: string,
  wishlist: ReadonlySet<string>,
  topFive: ReadonlySet<string> = EMPTY_SET
): number {
  return drinks.filter((drink) => matchesShowFilter(drink, filter, uid, wishlist, topFive)).length;
}
