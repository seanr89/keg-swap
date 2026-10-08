export interface BeerReview {
  id: string;
  reviewer: string;
  rating: number; // 0.5 - 10.0 (supports 0.5 step half ratings)
  comment: string;
  createdAt: string;
  userId?: string;
  price?: string;
  servingSize?: string;
  imageUrl?: string;
}

/**
 * A review as stored at `events/{eventId}/drinks/{drinkId}/reviews/{reviewId}`.
 * The beer details are denormalised so a user's reviews can be listed with a single
 * collection-group query (`where('userId', '==', uid)`) without loading every event.
 */
export interface BeerReviewDoc extends BeerReview {
  eventId: string;
  drinkId: string;
  drinkName: string;
  brewery: string;
  style: string;
}

/** How a drink is served; the tuple is shared by the type, the add form and the batch importer. */
export const SERVING_FORMATS = ['Cask', 'Keg', 'Can', 'Bottle'] as const;
export type ServingFormat = (typeof SERVING_FORMATS)[number];

export interface BeerDrink {
  id: string;
  name: string;
  brewery: string;
  location: string;
  abv: string;
  style: string;
  description: string;
  reviews: BeerReview[];
  imageUrl?: string;
  isVegan?: boolean; // absent means unknown, not "no"
  isGlutenFree?: boolean; // absent means unknown, not "no"
  caskOrKeg?: ServingFormat;
  createdAt?: string; // used to keep the drinks list in insertion order
}

/** A drink as stored at `events/{eventId}/drinks/{drinkId}` (reviews live in a subcollection). */
export type BeerDrinkDoc = Omit<BeerDrink, 'reviews'>;

export interface BeerEvent {
  id: string;
  name: string;
  date: string;
  endDate?: string;
  address: string;
  status: 'Upcoming' | 'Ongoing' | 'Completed' | 'Cancelled';
  /** Number of drinks in the `drinks` subcollection (kept in step by every drink write). */
  drinkCount?: number;
  /**
   * Legacy: drinks used to be embedded in the event document. They now live in
   * `events/{id}/drinks`; this is only populated on events not yet migrated, and
   * on the active event once its subcollections have been loaded (see `useEventDrinks`).
   */
  drinks?: BeerDrink[];
  attendees?: string[];
  url?: string;
  mapsUrl?: string;
  userId?: string; // uid of the creator; absent on legacy events
  createdAt?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  isPublic: boolean;
  friends?: string[];
  createdAt?: string;
}

export interface EventLocation {
  id: string;
  name: string;
  address: string;
  city?: string;
  postcode?: string;
  mapsUrl?: string;
  website?: string;
  notes?: string;
  createdAt: string;
}

