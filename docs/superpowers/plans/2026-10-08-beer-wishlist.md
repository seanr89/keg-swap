# Beer Wishlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in user bookmark beers on an open event and filter the drink list with `Show: All | Tried | Wishlist`.

**Architecture:** Bookmarks are stored privately at `users/{uid}/wishlists/{eventId}` as `{ drinkIds, updatedAt }`. A `useWishlist` hook (mirroring `useEventDrinks`) subscribes only while an event is open and exposes a `Set` plus a `toggle`. Filter logic is pure (`showFilter.ts`) so it can be checked without Firebase. `EventDetailScreen` calls the hook; `App.tsx` is untouched.

**Tech Stack:** React 19, TypeScript, Vite, Firebase Firestore (modular SDK), lucide-react. No test runner exists yet (see `CLAUDE.md`); the gate is `npm run lint` then `npm run build`, plus scratch-script checks for pure helpers.

**Spec:** `docs/superpowers/specs/2026-10-08-beer-wishlist-design.md`

**Prerequisite:** The working tree holds uncommitted, already-verified work from four earlier items (ABV filter, dietary badges, diary export, share buttons) that touches `EventDetailScreen.tsx`, `App.css`, `TODO.md`, `types.ts` and others. Commit that separately before starting so the wishlist commits stay clean. Do not stage it into the commits below.

## Global Constraints

- No `any`; domain types live in `src/types.ts` (AGENTS.md).
- No hardcoded colors in components; use CSS custom properties (`var(--primary)`, `var(--text-muted)`, ...).
- "Tried" means the signed-in user has a review on the drink: `review.userId === user.uid`.
- The wishlist is private: owner-only read and write, never on the public profile.
- Event screen only; no cross-event wishlist list.
- The existing `All Drinks | Reviewed Only` tabs (`filterHasReviews`) are replaced by `All | Tried (n) | Wishlist (n)`.
- Rules must be deployed before the client ships: `firebase deploy --only firestore:rules`.
- `App.tsx` must not change.
- Verification gate for every task: `npm run lint` then `npm run build` (both must pass).

## Review Focus

- A review with no `userId` (legacy) must not count as Tried (display names are not unique; `userId` only).
- A drink whose `reviews` is empty or missing must not crash the filter or the count.
- Wishlist ids for drinks that no longer exist on the event must not inflate the `Wishlist (n)` count.
- Opening event B right after event A must not show A's bookmarks while B's snapshot is loading.
- Rapid double-tapping the bookmark must end in a consistent state (array operators are idempotent).
- Bookmarking the first beer on an event with no wishlist doc must create the doc (merge write, not update).

---

## File Structure

| File | Responsibility |
| :--- | :--- |
| `src/utils/showFilter.ts` (new) | Pure `ShowFilter` type, `isTried`, `matchesShowFilter`, `countMatching`. No Firebase imports. |
| `src/utils/wishlist.ts` (new) | `wishlistRef` and `setWishlisted` (Firestore writes). |
| `src/hooks/useWishlist.ts` (new) | Live wishlist `Set` for one user and event, plus `toggle`. |
| `firestore.rules` (modify) | Owner-only `users/{uid}/wishlists/{eventId}`. |
| `src/components/EventDetailScreen.tsx` (modify) | Call the hook, new filter tabs, bookmark button on `BeerDrinkCard`. |
| `src/App.css` (modify) | `.share-btn.active` state for a saved bookmark. |
| `CLAUDE.md`, `TODO.md` (modify) | Document the data model, orphan note, and mark the item done. |

---

### Task 1: Filter logic, wishlist writes and security rules

**Files:**
- Create: `src/utils/showFilter.ts`
- Create: `src/utils/wishlist.ts`
- Modify: `firestore.rules` (inside `match /users/{uid}`)
- Check script (not committed): `<scratchpad>/showFilter.check.ts`

**Interfaces:**
- Produces:
  - `type ShowFilter = 'all' | 'tried' | 'wishlist'`
  - `isTried(drink: Pick<BeerDrink, 'reviews'>, uid: string): boolean`
  - `matchesShowFilter(drink: Pick<BeerDrink, 'id' | 'reviews'>, filter: ShowFilter, uid: string, wishlist: ReadonlySet<string>): boolean`
  - `countMatching(drinks: readonly Pick<BeerDrink, 'id' | 'reviews'>[], filter: ShowFilter, uid: string, wishlist: ReadonlySet<string>): number`
  - `wishlistRef(uid: string, eventId: string): DocumentReference`
  - `setWishlisted(uid: string, eventId: string, drinkId: string, on: boolean): Promise<void>`

- [ ] **Step 1: Write the failing check script**

Create `<scratchpad>/showFilter.check.ts` (scratchpad is the session scratch directory; do not commit it):

```ts
import assert from 'node:assert/strict';
import {
  isTried,
  matchesShowFilter,
  countMatching,
} from '/Users/seanrafferty/Documents/development/repos/keg-swap/src/utils/showFilter.ts';

const review = (userId?: string) => ({
  id: 'r', reviewer: 'x', rating: 5, comment: '', createdAt: '2026-01-01', ...(userId ? { userId } : {}),
});
const drink = (id: string, reviews: ReturnType<typeof review>[] = []) => ({ id, reviews });

// Tried: own review only
assert.equal(isTried(drink('a', [review('me')]), 'me'), true);
assert.equal(isTried(drink('a', [review('someone-else')]), 'me'), false);
assert.equal(isTried(drink('a', [review()]), 'me'), false, 'legacy review without userId is not Tried');
assert.equal(isTried(drink('a'), 'me'), false, 'empty reviews');
assert.equal(isTried({ reviews: undefined } as never, 'me'), false, 'missing reviews does not crash');

// Filters
const wishlist = new Set(['a', 'ghost']);
assert.equal(matchesShowFilter(drink('a'), 'all', 'me', wishlist), true);
assert.equal(matchesShowFilter(drink('a'), 'wishlist', 'me', wishlist), true);
assert.equal(matchesShowFilter(drink('b'), 'wishlist', 'me', wishlist), false);
assert.equal(matchesShowFilter(drink('b', [review('me')]), 'tried', 'me', wishlist), true);

// Counts ignore wishlist ids for drinks that no longer exist ('ghost')
const drinks = [drink('a'), drink('b', [review('me')])];
assert.equal(countMatching(drinks, 'wishlist', 'me', wishlist), 1);
assert.equal(countMatching(drinks, 'tried', 'me', wishlist), 1);
assert.equal(countMatching(drinks, 'all', 'me', wishlist), 2);

console.log('showFilter checks passed');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types <scratchpad>/showFilter.check.ts`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `showFilter.ts`.

- [ ] **Step 3: Create `src/utils/showFilter.ts`**

```ts
import type { BeerDrink } from '../types';

export type ShowFilter = 'all' | 'tried' | 'wishlist';

type FilterableDrink = Pick<BeerDrink, 'id' | 'reviews'>;

/** A drink is "tried" when the signed-in user has reviewed it. Reviews without a `userId` never count. */
export function isTried(drink: Pick<BeerDrink, 'reviews'>, uid: string): boolean {
  return (drink.reviews ?? []).some((review) => review.userId === uid);
}

export function matchesShowFilter(
  drink: FilterableDrink,
  filter: ShowFilter,
  uid: string,
  wishlist: ReadonlySet<string>
): boolean {
  if (filter === 'tried') return isTried(drink, uid);
  if (filter === 'wishlist') return wishlist.has(drink.id);
  return true;
}

/** Counts over the drinks that exist, so wishlist ids for removed drinks are ignored. */
export function countMatching(
  drinks: readonly FilterableDrink[],
  filter: ShowFilter,
  uid: string,
  wishlist: ReadonlySet<string>
): number {
  return drinks.filter((drink) => matchesShowFilter(drink, filter, uid, wishlist)).length;
}
```

- [ ] **Step 4: Run the check to verify it passes**

Run: `node --experimental-strip-types <scratchpad>/showFilter.check.ts`
Expected: prints `showFilter checks passed`.

- [ ] **Step 5: Create `src/utils/wishlist.ts`**

```ts
import { arrayRemove, arrayUnion, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

/** `users/{uid}/wishlists/{eventId}` holds `{ drinkIds: string[], updatedAt: string }`. */
export const wishlistRef = (uid: string, eventId: string) => doc(db, 'users', uid, 'wishlists', eventId);

/**
 * Adds or removes one drink. `merge` lets the first bookmark create the doc, and the array
 * operators are atomic, idempotent, and queue while offline.
 */
export function setWishlisted(uid: string, eventId: string, drinkId: string, on: boolean): Promise<void> {
  return setDoc(
    wishlistRef(uid, eventId),
    {
      drinkIds: on ? arrayUnion(drinkId) : arrayRemove(drinkId),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}
```

- [ ] **Step 6: Add the security rule**

In `firestore.rules`, inside `match /users/{uid} { ... }`, after `allow delete: if false;`, add:

```
      // Private bookmarks: one doc per event, readable and writable only by the owner.
      match /wishlists/{eventId} {
        allow read, write: if isSignedIn() && request.auth.uid == uid;
      }
```

The block must sit inside the `users/{uid}` match so `uid` is in scope. The rules cannot be run here without the Firebase emulator; verify by reading that the braces balance and `uid` is the path variable.

- [ ] **Step 7: Verify and commit**

Run: `npm run lint && npm run build`
Expected: both pass.

```bash
git add src/utils/showFilter.ts src/utils/wishlist.ts firestore.rules
git commit -m "feat: add wishlist filter logic, writes and owner-only rules

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `useWishlist` hook

**Files:**
- Create: `src/hooks/useWishlist.ts`

**Interfaces:**
- Consumes: `wishlistRef`, `setWishlisted` from `src/utils/wishlist.ts`.
- Produces: `useWishlist(uid: string, eventId: string): { wishlist: ReadonlySet<string>; toggle: (drinkId: string) => void }`

- [ ] **Step 1: Create `src/hooks/useWishlist.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { setWishlisted, wishlistRef } from '../utils/wishlist';

interface Slice {
  key: string;
  ids: Set<string>;
}

const EMPTY: ReadonlySet<string> = new Set<string>();
const sliceKey = (uid: string, eventId: string) => `${uid}/${eventId}`;

/**
 * Live set of the user's bookmarked drink ids for one event. Subscribes only while the event
 * is open. Data from a previously opened event is ignored until the new snapshot arrives.
 * Firestore applies local writes to snapshots straight away, so `toggle` needs no optimistic state.
 */
export function useWishlist(uid: string, eventId: string) {
  const [slice, setSlice] = useState<Slice | null>(null);

  useEffect(() => {
    const key = sliceKey(uid, eventId);
    return onSnapshot(
      wishlistRef(uid, eventId),
      (snapshot) => {
        const data = snapshot.data() as { drinkIds?: string[] } | undefined;
        setSlice({ key, ids: new Set(data?.drinkIds ?? []) });
      },
      (err) => console.error('Firestore wishlist snapshot error:', err)
    );
  }, [uid, eventId]);

  const wishlist: ReadonlySet<string> = slice?.key === sliceKey(uid, eventId) ? slice.ids : EMPTY;

  const toggle = useCallback(
    (drinkId: string) => {
      setWishlisted(uid, eventId, drinkId, !wishlist.has(drinkId)).catch((err: unknown) =>
        console.error('Failed to update wishlist:', err)
      );
    },
    [uid, eventId, wishlist]
  );

  return { wishlist, toggle };
}
```

- [ ] **Step 2: Verify and commit**

Run: `npm run lint && npm run build`
Expected: both pass. (There is no way to run the hook without Firebase; it is exercised in Task 3's manual check.)

```bash
git add src/hooks/useWishlist.ts
git commit -m "feat: add useWishlist hook

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Bookmark button, Show filter tabs and docs

**Files:**
- Modify: `src/components/EventDetailScreen.tsx` (imports; filter state around `filterHasReviews`; `filteredDrinks`; the `filter-tabs` block; `BeerDrinkCard` props and share area)
- Modify: `src/App.css` (append `.share-btn.active`)
- Modify: `CLAUDE.md` (Data model section)
- Modify: `TODO.md` (wishlist item and tracker row)

**Interfaces:**
- Consumes: `useWishlist`, `matchesShowFilter`, `countMatching`, `ShowFilter`.
- Produces: `BeerDrinkCard` props `isWishlisted: boolean` and `onToggleWishlist: () => void`.

- [ ] **Step 1: Imports**

In `EventDetailScreen.tsx`, add `Bookmark` to the `lucide-react` import list, and after the `drinkFlags` import add:

```ts
import { useWishlist } from '../hooks/useWishlist';
import { countMatching, matchesShowFilter, type ShowFilter } from '../utils/showFilter';
```

- [ ] **Step 2: Replace the reviews filter state and call the hook**

Replace
```ts
  const [filterHasReviews, setFilterHasReviews] = useState<'all' | 'with-reviews'>('all');
```
with
```ts
  const [selectedShow, setSelectedShow] = useState<ShowFilter>('all');
  const { wishlist, toggle: toggleWishlist } = useWishlist(user.uid, event.id);
```
(Both stay with the other hooks near the top of the component, before any early return.)

- [ ] **Step 3: Use the new filter in `filteredDrinks`**

Replace
```ts
    const matchesReviews = filterHasReviews === 'all' || (drink.reviews && drink.reviews.length > 0);
```
with
```ts
    const matchesShow = matchesShowFilter(drink, selectedShow, user.uid, wishlist);
```
and in the `return` of that function replace `matchesReviews` with `matchesShow`.

- [ ] **Step 4: Replace the two tabs with three**

Replace the whole `<div className="filter-tabs"> ... </div>` block (the `All Drinks` and `Reviewed Only` buttons) with:

```tsx
                <div className="filter-tabs" role="group" aria-label="Show">
                  {(
                    [
                      { id: 'all', label: 'All', count: event.drinks?.length ?? 0 },
                      { id: 'tried', label: 'Tried', count: countMatching(event.drinks ?? [], 'tried', user.uid, wishlist) },
                      { id: 'wishlist', label: 'Wishlist', count: countMatching(event.drinks ?? [], 'wishlist', user.uid, wishlist) },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`filter-tab-btn ${selectedShow === tab.id ? 'active' : ''}`}
                      aria-pressed={selectedShow === tab.id}
                      onClick={() => setSelectedShow(tab.id)}
                      style={{ padding: '6px 12px', fontSize: '13px' }}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>
```

- [ ] **Step 5: Pass the props to `BeerDrinkCard`**

In the `<BeerDrinkCard` usage add:

```tsx
                    isWishlisted={wishlist.has(drink.id)}
                    onToggleWishlist={() => toggleWishlist(drink.id)}
```

In `BeerDrinkCardProps` add `isWishlisted: boolean;` and `onToggleWishlist: () => void;`, and add both to the destructured params of `BeerDrinkCard`.

- [ ] **Step 6: Render the bookmark button**

Immediately before the `<ShareButton` inside `BeerDrinkCard`, add:

```tsx
          <button
            type="button"
            className={`share-btn ${isWishlisted ? 'active' : ''}`}
            onClick={onToggleWishlist}
            aria-pressed={isWishlisted}
            aria-label={isWishlisted ? `Remove ${drink.name} from wishlist` : `Add ${drink.name} to wishlist`}
            title={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <Bookmark size={15} fill={isWishlisted ? 'currentColor' : 'none'} />
          </button>
```

- [ ] **Step 7: CSS for the saved state**

Append to `src/App.css`:

```css
.share-btn.active {
  color: var(--primary);
}
```

- [ ] **Step 8: Docs**

In `CLAUDE.md`, in the Data model section after the "Other collections" line, add:

```
Wishlist bookmarks are private per-user data at `users/{uid}/wishlists/{eventId}` (`{ drinkIds, updatedAt }`), read by `useWishlist` only while an event is open and governed by an owner-only rule in `firestore.rules`. Deleting an event leaves these small docs behind (an owner cannot delete other users' private docs); nothing reads them. "Tried" in the event filter means the user has a review on the drink (`review.userId`).
```

In `TODO.md`, change the wishlist item's `- [ ]` to `- [x]`, append under it:

```
  - *Status:* Done. Bookmark button on each beer card (`useWishlist`, `src/utils/wishlist.ts`, `src/utils/showFilter.ts`), private `users/{uid}/wishlists/{eventId}` docs, and `All | Tried | Wishlist` tabs replacing "Reviewed Only". **Deploy `firestore.rules` before shipping** (`firebase deploy --only firestore:rules`); the rules were verified by reading only, not with the emulator.
```

and change the tracker row `Beer wishlist / "Want to try" toggle` status from `Pending` to `Completed (deploy rules)`.

- [ ] **Step 9: Verify**

Run: `npm run lint && npm run build`
Expected: both pass.

Then in `npm run dev` with a Firebase env and the rules deployed (or the emulator), open an event and check: bookmark a beer and it fills; reload and it persists; the `Wishlist (n)` tab shows only bookmarked beers and the count matches; the `Tried (n)` tab shows only beers you reviewed; open a second event and confirm the first event's bookmarks do not flash; double-tap a bookmark and confirm it settles. If rules are not deployed, expect a `permission-denied` console error and no persistence; say so in the report instead of claiming success.

- [ ] **Step 10: Commit**

```bash
git add src/components/EventDetailScreen.tsx src/App.css CLAUDE.md TODO.md
git commit -m "feat: add beer wishlist and Show: All/Tried/Wishlist filter

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Note: if the earlier uncommitted work was committed first (see Prerequisite), these files contain only wishlist changes. If it was not, stage hunks with `git add -p` so those changes are not mixed in.
