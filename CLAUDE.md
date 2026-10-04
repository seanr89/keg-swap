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

**`src/App.tsx` (~1000 lines) is the controller for everything.** It owns all Firestore subscriptions (`onSnapshot` on `users`, `events`, `locations`, plus the signed-in user's own doc), all write handlers (add/delete events, status changes, add/edit drinks and reviews, attendees, location CRUD), and passes data and callbacks down as props. Navigation is state flags (`activeEventId`, `showProfile`, `showAdmin`), not URLs. Components in `src/components/` are mostly presentational. `EventDetailScreen.tsx` (~1200 lines) is the other large file. Both are slated for decomposition into hooks and sub-components (see `TODO.md` section 5).

### Data model (`src/types.ts`)
Drinks and reviews are **embedded arrays inside the `events/{id}` document** (`BeerEvent.drinks[].reviews[]`), not subcollections. Consequently every drink or review write in `App.tsx` reads the event from local state, rebuilds the whole `drinks` array, and `updateDoc`s it. Keep that in mind for the 1MB document limit and for concurrent-write races. Migration to subcollections is planned but not done.

Other collections: `users/{uid}` (`UserProfile`, with `isPublic`, `friends`), `locations/{id}` (`EventLocation`, admin-managed).

### Images
Images go to Firebase Storage under `events/{eventId}/...` and only the download URL is stored in Firestore. `src/utils/imageUtils.ts` handles canvas compression, upload, and a legacy migration: when the events snapshot fires, `App.tsx` finds events whose drinks/reviews still hold base64 `data:` URLs, uploads them, and writes the URLs back. `storage.rules` restricts uploads to authenticated users, images only, under 5MB. There is no `firestore.rules` file in the repo.

### Theming
Theme is a `data-theme` attribute, persisted in `localStorage` key `keg_swap_theme` (default dark), but only when the user has accepted the "preferences" cookie consent (otherwise the key is removed). An inline script in `index.html` applies it before first paint to avoid FOUC; preserve that when touching theme code. All colors are CSS custom properties from `src/index.css`; do not hardcode hex values in components.

### Ratings and ABV
Ratings are 0.5–10.0 in 0.5 steps (`StarRating.tsx` renders beer glasses). `abv` is stored as a string like `"4.6%"`. `beers.json` is the sample/batch-import dataset in the shape `EventDetailScreen`'s batch uploader accepts.

## Known gotchas (also tracked in `TODO.md`)

- Admin is detected client-side by hardcoded email comparison in `App.tsx` (`isAdmin`) and `AdminScreen.tsx`; there is no server-side enforcement. Don't extend this pattern. Prefer custom claims or a roles doc.
- `App.tsx` subscribes to the **entire** `users` collection and filters `isPublic` on the client. Server-side `where('isPublic', '==', true)` is the intended fix.
- Event deletion has no confirmation or ownership check yet. `AGENTS.md` requires a confirmation dialog for any destructive action you add.
- `AGENTS.md` also defines engineering rules (no `any`, no hardcoded colors, domain types centralized in `src/types.ts`) and four workspace skills in `.agents/skills/` (`firebase-data-architecture`, `component-refactoring`, `beer-catalog-manager`, `keg-quality-testing`). Read the relevant one before working in that area.
