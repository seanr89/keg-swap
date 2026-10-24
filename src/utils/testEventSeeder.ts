import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { addDrinks, deleteEventCascade } from './eventData';
import type { BeerDrink, BeerEvent } from '../types';

/**
 * 10 Diverse, realistic test beers spanning multiple styles, ABVs,
 * serving types, and dietary options for verification and testing.
 */
export const SAMPLE_TEST_BEERS: Omit<BeerDrink, 'id' | 'reviews'>[] = [
  {
    name: 'Pale Fire',
    brewery: 'Northern Monk',
    location: 'Leeds',
    abv: '4.8%',
    style: 'Pale Ale',
    description: 'Clean, refreshing hazy pale ale brewed with Citra and Mosaic hops.',
    type: 'Cask',
    caskOrKeg: 'Cask',
    isVegan: true,
  },
  {
    name: 'Midnight Porter',
    brewery: 'Thornbridge',
    location: 'Bakewell',
    abv: '5.6%',
    style: 'Porter',
    description: 'Rich roasted malts with notes of dark chocolate and espresso.',
    type: 'Cask',
    caskOrKeg: 'Cask',
  },
  {
    name: 'Citra Haze IPA',
    brewery: 'Deya Brewing Company',
    location: 'Cheltenham',
    abv: '6.5%',
    style: 'IPA',
    description: 'Intense tropical aroma bursting with passionfruit, peach, and citrus.',
    type: 'Keg',
    caskOrKeg: 'Keg',
    isVegan: true,
  },
  {
    name: 'Plum Porter Grand Reserve',
    brewery: 'Titanic Brewery',
    location: 'Stoke-on-Trent',
    abv: '6.5%',
    style: 'Dark Ale',
    description: 'Special edition plum porter with deep rich fruit notes and warming alcohol sweetness.',
    type: 'Cask',
    caskOrKeg: 'Cask',
  },
  {
    name: 'Session Crisp Lager',
    brewery: 'Braybrooke Beer Co',
    location: 'Market Harborough',
    abv: '4.2%',
    style: 'Lager',
    description: 'Properly lagered, crisp and snappy helles-style lager with subtle herbal noble hops.',
    type: 'Keg',
    caskOrKeg: 'Keg',
    isVegan: true,
    isGlutenFree: true,
  },
  {
    name: 'Tropical Sour Symphony',
    brewery: 'Vault City Brewing',
    location: 'Edinburgh',
    abv: '7.2%',
    style: 'Sour',
    description: 'Heavily fruited modern sour packed with mango, guava, and passion fruit.',
    type: 'Keg',
    caskOrKeg: 'Keg',
    isVegan: true,
  },
  {
    name: 'Imperial Bourbon Stout',
    brewery: 'Vocation Brewery',
    location: 'Hebden Bridge',
    abv: '10.2%',
    style: 'Stout',
    description: 'Aged in oak bourbon casks with decadent vanilla, molasses, and cocoa.',
    type: 'Keg',
    caskOrKeg: 'Keg',
  },
  {
    name: 'Classic Best Bitter',
    brewery: "Timothy Taylor's",
    location: 'Keighley',
    abv: '4.0%',
    style: 'Best Bitter',
    description: 'A classic Yorkshire bitter with golden malt balance and delicate peppery hop finish.',
    type: 'Cask',
    caskOrKeg: 'Cask',
  },
  {
    name: 'West Coast Hop Hazard',
    brewery: 'Cloudwater Brew Co',
    location: 'Manchester',
    abv: '6.8%',
    style: 'IPA',
    description: 'Piney, resinous, clear West Coast IPA with assertive clean bitterness and grapefruit peel.',
    type: 'Keg',
    caskOrKeg: 'Keg',
    isVegan: true,
  },
  {
    name: 'Raspberry Kettle Sour',
    brewery: 'Yonder Brewing',
    location: 'Somerset',
    abv: '3.8%',
    style: 'Sour',
    description: 'Vibrant and tart session sour conditioned on thousands of fresh local raspberries.',
    type: 'Keg',
    caskOrKeg: 'Keg',
    isVegan: true,
    isGlutenFree: true,
  },
];

/**
 * Standard test event metadata.
 */
export const SAMPLE_TEST_EVENT: Omit<BeerEvent, 'id'> = {
  name: '[TEST] Keg Swap Tasting Fest',
  date: new Date().toISOString().split('T')[0],
  address: 'The Sample Taproom, 12 Hop Street, Sheffield, S1 2XX',
  status: 'Upcoming',
  url: 'https://kegswap.raffrock.com',
  drinkCount: 0,
};

/**
 * Generates a random UUID or fallback identifier for drinks.
 */
export function generateDrinkId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Seeds a dedicated test event and atomically inserts the 10 test beers into Firestore.
 *
 * @param userId Optional creator user UID
 * @param customEventData Optional overrides for event metadata
 * @returns Object containing the created eventId and the inserted drink count (10)
 */
export async function seedTestEventWithDrinks(
  userId?: string,
  customEventData?: Partial<Omit<BeerEvent, 'id'>>
): Promise<{ eventId: string; drinkCount: number }> {
  const eventPayload: Omit<BeerEvent, 'id'> = {
    ...SAMPLE_TEST_EVENT,
    ...customEventData,
    drinkCount: 0,
    ...(userId ? { userId } : {}),
    createdAt: new Date().toISOString(),
  };

  const docRef = await addDoc(collection(db, 'events'), eventPayload);
  const eventId = docRef.id;

  const drinksWithIds: BeerDrink[] = SAMPLE_TEST_BEERS.map((drink) => ({
    ...drink,
    id: generateDrinkId(),
    reviews: [],
  }));

  await addDrinks(eventId, drinksWithIds);

  return { eventId, drinkCount: drinksWithIds.length };
}

export { deleteEventCascade };
