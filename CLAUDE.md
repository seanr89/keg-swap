# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Vite dev server on http://localhost:5173
npm run lint      # Oxlint (config: .oxlintrc.json)
npm run build     # tsc -b && vite build -> dist/
npm run preview   # serve the production build
```

- There is **no test runner yet** (no `npm test`, no Vitest). `.agents/skills/keg-quality-testing/SKILL.md` describes the planned Vitest + React Testing Library setup; `TODO.md` tracks it. Until it exists, the verification gate is `npm run lint` then `npm run build` (this is also what CI runs).
- Firebase config comes from `VITE_FIREBASE_*` env vars (`.env.local` locally, gitignored; CI writes `.env` from GitHub Secrets). Without them the app cannot authenticate or load data.
- Deploy: pushes to `main` build and deploy to Azure Static Web Apps via `.github/workflows/build.yml`; PRs get preview environments.

## Architecture

Single-page React 19 + Vite + TypeScript app backed directly by Firebase (Auth, Firestore, Storage). There is no router and no server code in this repo.

**`src/App.tsx` (~1000 lines) is the controller for everything.** It owns all Firestore subscriptions (`onSnapshot` on `users`, `events`, `locations`, plus the signed-in user's own doc), all write handlers (add/delete events, status changes, add/edit drinks and reviews, attendees, location CRUD), and passes data and callbacks down as props. Navigation is state flags (`activeEventId`, `showProfile`, `showAdmin`), not URLs. `EventDetailScreen`, `UserProfileScreen` and `AdminScreen` are `React.lazy` chunks wrapped in `Suspense`, and `vite.config.ts` splits `react`/`firebase` into vendor chunks (keep new heavy screens lazy). Components in `src/components/` are mostly presentational. `EventDetailScreen.tsx` (~1200 lines) is the other large file. Both are slated for decomposition into hooks and sub-components (see `TODO.md` section 5).

### Data model (`src/types.ts`)
Drinks and reviews are **subcollections**: `events/{id}/drinks/{drinkId}` and `events/{id}/drinks/{drinkId}/reviews/{reviewId}`. The events list therefore only downloads event metadata (plus a denormalised `drinkCount`); `useEventDrinks` subscribes to an event's drinks and reviews (reviews via a collection-group query on `eventId`) only while that event is open, and `App.tsx` merges them into `activeEvent.drinks`. All reads/writes for this live in `src/utils/eventData.ts`. Review docs denormalise `eventId`/`drinkId`/`drinkName`/`brewery`/`style` so `useUserReviews` can list a user's reviews with one collection-group query on `userId`. Firestore does not cascade deletes: `deleteEventCascade` removes drinks and reviews before the event.

Events created before this still hold an embedded `drinks` array. The events snapshot in `App.tsx` migrates them (`migrateLegacyEvent`, which also moves base64 images to Storage) and removes the field; `assembleDrinks` merges both shapes in the meantime. Collection-group queries need the field overrides in `firestore.indexes.json`.

Other collections: `users/{uid}` (`UserProfile`, with `isPublic`, `friends`), `locations/{id}` (`EventLocation`, admin-managed).

Wishlist bookmarks are private per-user data at `users/{uid}/wishlists/{eventId}` (`{ drinkIds, updatedAt }`), read by `useWishlist` only while an event is open and governed by an owner-only rule in `firestore.rules`. Deleting an event leaves these small docs behind (an owner cannot delete other users' private docs); nothing reads them. "Tried" in the event filter means the user has a review on the drink (`review.userId`).

### Images
Images go to Firebase Storage under `events/{eventId}/...` and only the download URL is stored in Firestore. `src/utils/imageUtils.ts` handles canvas compression (WebP, max 600px, quality 0.75, with a JPEG fallback where the browser cannot encode WebP; the storage path extension follows the real format), upload, and migration of legacy base64 `data:` URLs (run as part of `migrateLegacyEvent`). `storage.rules` restricts uploads to authenticated users, images only, under 5MB. Firestore access is governed by `firestore.rules` (deploy with `firebase deploy --only firestore:rules,firestore:indexes,storage`; deploy these before shipping client changes that depend on them).

### Theming
Theme is a `data-theme` attribute, persisted in `localStorage` key `keg_swap_theme` (default dark), but only when the user has accepted the "preferences" cookie consent (otherwise the key is removed). An inline script in `index.html` applies it before first paint to avoid FOUC; preserve that when touching theme code. All colors are CSS custom properties from `src/index.css`; do not hardcode hex values in components.

### Offline / PWA
`vite-plugin-pwa` (config in `vite.config.ts`) precaches the app shell and cache-first caches Storage images; `src/firebase.ts` enables Firestore persistent local cache, which serves cached events/drinks/reviews offline and queues writes. Icons in `public/` are generated from `public/pwa-icon.svg` with `npx pwa-assets-generator`. The service worker only exists in production builds (`npm run build && npm run preview`).

### Ratings and ABV
Ratings are 0.5–10.0 in 0.5 steps (`StarRating.tsx` renders beer glasses). `abv` is stored as a string like `"4.6%"`. `beers.json` is the sample/batch-import dataset in the shape `EventDetailScreen`'s batch uploader accepts.

## Known gotchas (also tracked in `TODO.md`)

- Admin status is the existence of `admins/{uid}` (read by `src/hooks/useIsAdmin.ts`, enforced in `firestore.rules`). Admin docs are created manually in the Firebase console; deploy rules only after your own admin doc exists.
- Event deletion goes through `ConfirmDialog` and is limited to the creator or an admin (events without `userId` are admin-only). Location and drink deletes still lack confirmation; `AGENTS.md` requires a confirmation dialog for any destructive action you add.
- `App.tsx` fetches only public users (`where('isPublic', '==', true)`); review attribution on profiles uses `review.userId` only. Dates like `YYYY-MM-DD` must go through `parseLocalDate` (`src/utils/dateUtils.ts`), not `new Date(str)`.
- `AGENTS.md` also defines engineering rules (no `any`, no hardcoded colors, domain types centralized in `src/types.ts`) and four workspace skills in `.agents/skills/` (`firebase-data-architecture`, `component-refactoring`, `beer-catalog-manager`, `keg-quality-testing`). Read the relevant one before working in that area.
