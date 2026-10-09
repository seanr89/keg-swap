# Beer wishlist ("Want to try") — design

## Problem
Attendees at a festival or swap night have no way to flag beers they want to sample. The event
screen can only filter by style, ABV, format, dietary info and "Reviewed Only" (any user's review),
which does not tell a user what they still plan to drink or what they have already tried.

## Goal
- A user can bookmark any beer on an open event and see a `Show: All | Tried | Wishlist` filter.
- Bookmarks are private to the user and work offline.

## Agreed scope and definitions
- Event screen only. There is no cross-event "My Wishlist" list (revisit if asked).
- **Tried** means the signed-in user has a review on the drink (`review.userId === user.uid`).
  Nothing extra is stored. A beer drunk but not reviewed appears only under All.
- The wishlist is private: not shown to friends and not part of the public profile.

## Non-goals
- Cross-event wishlist, sharing a wishlist, reminders or notifications.
- A separate "I've had this" flag.
- Cleaning up wishlist docs when an event is deleted (see Failure handling).

## Design

### Data
`users/{uid}/wishlists/{eventId}` holds `{ drinkIds: string[], updatedAt: string }`, one doc per
user per event. Rejected alternatives: a doc per bookmarked beer (many reads and docs for a
100-beer festival) and a `wishlist` field on `users/{uid}` (public profile docs are readable by
other signed-in users, so it would leak, and every client downloads those docs).

### `firestore.rules`
Add under `match /users/{uid}`:

```
match /wishlists/{eventId} {
  allow read, write: if isSignedIn() && request.auth.uid == uid;
}
```

The existing `users/{uid}` rule does not cover subcollections, so this block is required.
Deploy rules before shipping the client (`firebase deploy --only firestore:rules`); without them
reads fail with `permission-denied`, which is logged, and bookmarks do not persist.

### Code
- `src/utils/wishlist.ts`: `wishlistRef(uid, eventId)` and
  `setWishlisted(uid, eventId, drinkId, on)`, which calls
  `setDoc(ref, { drinkIds: arrayUnion(id) | arrayRemove(id), updatedAt }, { merge: true })`. `merge`
  makes the first bookmark create the doc, and array operators are atomic and queue offline.
  Pure helpers `isTried(drink, uid)` and `matchesShowFilter(drink, filter, uid, wishlist)` live
  here too.
- `src/hooks/useWishlist.ts`: `useWishlist(uid, eventId)` returns
  `{ wishlist: Set<string>, toggle(drinkId) }`. It mirrors `useEventDrinks`: subscribes only while an
  event is open and ignores data from a previously opened event until the new snapshot arrives.
  Firestore applies local writes to snapshots immediately, so no separate optimistic state is kept.
- `EventDetailScreen` calls the hook (it already has `user` and `event`); `App.tsx` is unchanged.

### UI
- `BeerDrinkCard` takes `isWishlisted` and `onToggleWishlist`, and renders a lucide `Bookmark`
  button (filled when saved) next to the share button, styled with the existing `.share-btn` class
  and theme tokens (no hardcoded colors). It sets `aria-pressed` and a label such as
  "Add Faith to wishlist" / "Remove Faith from wishlist".
- The toolbar's `All Drinks | Reviewed Only` tabs (`filterHasReviews`) are replaced by
  `All | Tried (n) | Wishlist (n)`. Counts only include drinks that currently exist on the event,
  so stale ids are ignored. This intentionally drops "Reviewed Only", which matched any user's
  review and overlapped confusingly with Tried.
- The "No drinks match your filters" empty state already covers empty Tried and Wishlist views.

### Failure handling
- A failed write is logged with `console.error`; the next snapshot restores the real state.
- Deleting an event leaves orphan wishlist docs: an owner cannot delete other users' private docs
  and the data is tiny. Nothing reads them. Document this in `CLAUDE.md`.

## Testing
- No test runner exists yet, so the gate is `npm run lint` and `npm run build`.
- `isTried` and `matchesShowFilter` are pure and exercised in a scratch script.
- The rules cannot be exercised without the Firebase emulator; verify by reading and say so.
- Manual check in the dev server: bookmark, reload, switch events, go offline and bookmark.

## Docs
Update `CLAUDE.md` (data model section, wishlist subcollection and orphan note) and mark the
TODO item done.
