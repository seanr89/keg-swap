# Keg Swap 🍺 — Project Roadmap & Task Backlog (`TODO.md`)

This document tracks identified bugs, security vulnerabilities, performance bottlenecks, and proposed feature additions for the **Keg Swap** application.

---

## 🚦 Priority Legend
- `[P0]` **Blocker / Security / Data Loss Risk:** Must be resolved immediately before scaling production traffic.
- `[P1]` **High Priority:** Major UX friction, privacy leaks, or bundle/scalability issues.
- `[P2]` **Medium Priority:** Important features, performance optimizations, and code refactoring.
- `[P3]` **Low Priority / Nice to Have:** Quality-of-life enhancements and exploratory ideas.

---

## 🐛 1. Bugs & Security Vulnerabilities

- [x] **[P0] Firestore 1MB Document Limit Breach via Base64 Images** `firebase-specialist`
  - *Location:* [`src/utils/imageUtils.ts`](file:///Users/seanrafferty/Documents/development/repos/keg-swap/src/utils/imageUtils.ts#L60) & [`src/App.tsx`](file:///Users/seanrafferty/Documents/development/repos/keg-swap/src/App.tsx#L326-L342)
  - *Issue:* Drinks and reviews store compressed canvas JPEG data URLs directly within `events/{eventId}` documents. An event with 10–15 drinks containing photo reviews will exceed the Firestore 1MB document cap and trigger write failures.
  - *Fix:* Migrate image storage to Firebase Cloud Storage (`events/{id}/drinks/...`) or an external CDN; save only the download URL string in Firestore.

- [ ] **[P0] Unconfirmed & Unauthorized Event Deletion** `qa-auditor` `frontend-refactorer`
  - *Location:* [`src/components/EventCard.tsx`](file:///Users/seanrafferty/Documents/development/repos/keg-swap/src/components/EventCard.tsx#L230-L241) & [`src/App.tsx`](file:///Users/seanrafferty/Documents/development/repos/keg-swap/src/App.tsx#L288-L297)
  - *Issue:* Clicking the trash icon or performing a touch swipe gesture triggers `deleteDoc` immediately without a confirmation prompt or ownership validation. Any user can delete any event.
  - *Fix:* Add a modal confirmation dialog (`"Are you sure you want to delete this event?"`) and restrict delete privileges to the event creator (`userId == auth.uid`) or an admin.

- [ ] **[P1] Private User Profiles Leaked to All Clients** `firebase-specialist`
  - *Location:* [`src/App.tsx`](file:///Users/seanrafferty/Documents/development/repos/keg-swap/src/App.tsx#L132-L139) & [`src/components/UserSearchModal.tsx`](file:///Users/seanrafferty/Documents/development/repos/keg-swap/src/components/UserSearchModal.tsx#L60-L62)
  - *Issue:* `App.tsx` subscribes to the entire `users` collection via `onSnapshot(collection(db, 'users'))`. Filtering for `isPublic !== false` occurs strictly on the client, sending all emails and private profile data to all connected clients.
  - *Fix:* Update the Firestore query to filter server-side: `query(collection(db, 'users'), where('isPublic', '==', true))`.

- [ ] **[P1] Client-Only Hardcoded Admin Credentials** `firebase-specialist`
  - *Location:* [`src/App.tsx`](file:///Users/seanrafferty/Documents/development/repos/keg-swap/src/App.tsx#L426) & [`src/components/AdminScreen.tsx`](file:///Users/seanrafferty/Documents/development/repos/keg-swap/src/components/AdminScreen.tsx#L21)
  - *Issue:* `srafferty89@gmail.com` is hardcoded on the client. Without corresponding Firestore security rules, malicious users can bypass client guards and directly write or delete from `/locations`.
  - *Fix:* Add `firestore.rules` enforcing admin privileges server-side and migrate admin verification to Firebase Auth Custom Claims or an `/admins/{uid}` collection.

- [ ] **[P2] Date Timezone Off-by-One in Event Display** `frontend-refactorer`
  - *Location:* [`src/components/EventCard.tsx`](file:///Users/seanrafferty/Documents/development/repos/keg-swap/src/components/EventCard.tsx#L110-L150)
  - *Issue:* Parsing ISO date strings `YYYY-MM-DD` with `new Date(str)` parses as UTC midnight, which displays as the previous day in timezones west of UTC (e.g. US timezones).
  - *Fix:* Normalize date formatting with calendar-safe parsing (e.g., splitting `YYYY-MM-DD` or using `Intl.DateTimeFormat` with explicit UTC).

- [ ] **[P2] User Review Misattribution by Display Name** `firebase-specialist`
  - *Location:* [`src/components/UserProfileScreen.tsx`](file:///Users/seanrafferty/Documents/development/repos/keg-swap/src/components/UserProfileScreen.tsx#L64-L71)
  - *Issue:* Legacy fallback matches reviews by `review.reviewer === user.displayName || review.reviewer === user.email`. If two users share the same display name, reviews will be cross-attributed.
  - *Fix:* Enforce `userId` on all reviews and remove non-unique display name matching.

---

## ⚡ 2. Performance & Scalability Optimizations

- [ ] **[P1] Code-Splitting & Route-Level Bundle Splitting (Reduce 861 kB Bundle)** `frontend-refactorer`
  - *Location:* [`src/App.tsx`](file:///Users/seanrafferty/Documents/development/repos/keg-swap/src/App.tsx) & [`vite.config.ts`](file:///Users/seanrafferty/Documents/development/repos/keg-swap/vite.config.ts)
  - *Issue:* Vite emits a warning that `dist/assets/index-*.js` is **861 kB** because `AdminScreen`, `UserProfileScreen`, `EventDetailScreen`, and all Lucide icons are bundled together.
  - *Fix:* Use `React.lazy()` and `Suspense` for heavy screens:
    ```tsx
    const AdminScreen = lazy(() => import('./components/AdminScreen').then(m => ({ default: m.AdminScreen })));
    const UserProfileScreen = lazy(() => import('./components/UserProfileScreen').then(m => ({ default: m.UserProfileScreen })));
    const EventDetailScreen = lazy(() => import('./components/EventDetailScreen').then(m => ({ default: m.EventDetailScreen })));
    ```

- [ ] **[P1] Firestore Subcollections Migration for Drinks & Reviews** `firebase-specialist`
  - *Location:* [`src/types.ts`](file:///Users/seanrafferty/Documents/development/repos/keg-swap/src/types.ts#L21-L32)
  - *Issue:* When fetching the events dashboard, Firestore downloads all drinks and reviews for all historical events into memory.
  - *Fix:* Split drinks and reviews into subcollections:
    - `/events/{eventId}/drinks/{drinkId}`
    - `/events/{eventId}/drinks/{drinkId}/reviews/{reviewId}`
    - Events list only fetches event metadata; beer details load on-demand when opening an event.

- [ ] **[P2] List Virtualization for High-Volume Beer Festivals** `frontend-refactorer`
  - *Location:* [`src/components/EventDetailScreen.tsx`](file:///Users/seanrafferty/Documents/development/repos/keg-swap/src/components/EventDetailScreen.tsx)
  - *Issue:* Festivals with 100+ beers render all card DOM nodes and star ratings simultaneously, causing frame drops on low-power mobile devices.
  - *Fix:* Implement list virtualization or apply modern CSS `content-visibility: auto` to off-screen drink cards.

- [ ] **[P2] WebP Image Compression & Thumbnail Generation** `frontend-refactorer`
  - *Location:* [`src/utils/imageUtils.ts`](file:///Users/seanrafferty/Documents/development/repos/keg-swap/src/utils/imageUtils.ts)
  - *Issue:* Canvas encodes to JPEG quality 0.8 at up to 1000×1000px, creating files of 200–400KB each.
  - *Fix:* Switch export format to WebP with responsive thumbnail sizing (`maxWidth = 600`, `quality = 0.75`), reducing image sizes by ~60%.

- [ ] **[P3] Service Worker & Offline PWA Capabilities** `frontend-refactorer`
  - *Issue:* Beer festival venues (breweries, taprooms, cellars) frequently suffer from poor cellular connectivity.
  - *Fix:* Add `vite-plugin-pwa` with service worker caching for event schedules, drinks lists, and offline review queuing.

---

## ✨ 3. Feature Additions & Enhancements

- [ ] **[P1] Beer Wishlist / "Want to Try" Bookmark Toggle** `frontend-refactorer`
  - Add a bookmark/heart icon on beer cards so attendees can flag beers they want to sample during a festival or swap night.
  - Filter toggle on event screen: `Show: All | Tried | Wishlist`.

- [ ] **[P1] Dietary & Allergen Badges (Vegan, Gluten-Free, Organic)** `frontend-refactorer` `beer-catalog-manager`
  - Update `BeerDrink` model to support flags: `isVegan?: boolean`, `isGlutenFree?: boolean`, `caskOrKeg?: 'Cask' | 'Keg' | 'Can' | 'Bottle'`.
  - Add badge indicators and filters to [`EventDetailScreen.tsx`](file:///Users/seanrafferty/Documents/development/repos/keg-swap/src/components/EventDetailScreen.tsx).

- [ ] **[P2] Flavor & Tasting Notes Tag Cloud** `beer-catalog-manager` `frontend-refactorer`
  - Allow reviewers to pick or enter taste descriptor tags (e.g. `Hoppy`, `Citrus`, `Roasty`, `Chocolate`, `Hazy`, `Sour`, `Piney`, `Smoky`).
  - Display aggregate top-3 tags on the beer card.

- [ ] **[P2] ABV Range & Style Filtering** `frontend-refactorer`
  - Add a slider or segmented control to filter drinks by ABV brackets:
    - Low / Session (< 4.0%)
    - Mid-range (4.0% – 6.0%)
    - Strong (6.1% – 8.5%)
    - Imperial / High Gravity (> 8.5%)

- [ ] **[P2] Social Tasting Feed & Friend Comparison** `firebase-specialist` `frontend-refactorer`
  - Friend activity tab showing real-time reviews from user friends.
  - On beer cards, highlight friends' ratings: *"Sarah rated this 9.0/10"*.

- [ ] **[P3] Web Share API & Deep Linking** `frontend-refactorer`
  - Add native share buttons on event cards and drinks cards using `navigator.share` with fallback to clipboard URL copy.
  - Support query param deep linking: `?event=<id>&drink=<drinkId>`.

- [ ] **[P3] Export Tasting Diary (CSV / JSON)** `frontend-refactorer`
  - In [`UserProfileScreen.tsx`](file:///Users/seanrafferty/Documents/development/repos/keg-swap/src/components/UserProfileScreen.tsx), provide an "Export My Reviews" button exporting drink names, breweries, ratings, dates, and tasting notes to CSV.

---

## 🧪 4. Testing, Quality & CI/CD Enhancements

- [ ] **[P1] Set Up Vitest & React Testing Library** `qa-auditor`
  - Install dependencies: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`.
  - Configure `vite.config.ts` test block and setup test runner in `package.json` (`"test": "vitest run"`).

- [ ] **[P1] Core Unit & Component Test Suite** `qa-auditor`
  - `StarRating.test.tsx`: Verify half-glass and full-glass math (0.5 to 10.0 scale) and keyboard accessibility.
  - `EventModal.test.tsx`: Verify required form fields, invalid dates, and light-dismiss behavior.
  - `EventCard.test.tsx`: Test touch swipe gesture logic, status changes, and deletion confirmations.
  - `AuthScreen.test.tsx`: Test error translations for invalid credentials and password strength.

- [ ] **[P2] CI Quality Gate Step in GitHub Actions** `qa-auditor`
  - Update [`.github/workflows/build.yml`](file:///Users/seanrafferty/Documents/development/repos/keg-swap/.github/workflows/build.yml) to run `npm test` after `npm run lint` and before `npm run build`.

---

## 🏗️ 5. Code Quality & Component Decomposition

- [ ] **[P1] Extract Custom Hooks from `App.tsx`** `frontend-refactorer`
  - Extract `src/hooks/useAuth.ts`: Auth listener, user profile snapshot, admin verification.
  - Extract `src/hooks/useEvents.ts`: Firestore events query, event addition/deletion, status updates.
  - Extract `src/hooks/useLocations.ts`: Firestore locations query and CRUD.

- [ ] **[P1] Deconstruct `EventDetailScreen.tsx` into Child Components** `frontend-refactorer`
  - Split 1,154 lines into modular components under `src/components/event-detail/`:
    - `DrinkCard.tsx`: Drink item display, rating badge, review toggle.
    - `ReviewModal.tsx`: Review form dialog with star rating picker.
    - `DrinkFormModal.tsx`: Add/edit beer dialog.
    - `BatchUploadModal.tsx`: Batch JSON import dialog.
    - `ImageLightbox.tsx`: Fullscreen photo modal.

---

## 📌 Implementation Progress Tracker

| Task | Priority | Assigned Subagent | Status |
| :--- | :---: | :--- | :---: |
| Fix Firestore 1MB document limit via Storage | P0 | `firebase-specialist` | Completed |
| Add confirmation modal for event deletion | P0 | `frontend-refactorer` | Pending |
| Restrict user queries to `isPublic == true` | P1 | `firebase-specialist` | Pending |
| Add server-side `firestore.rules` | P1 | `firebase-specialist` | Pending |
| Code-split heavy routes (`React.lazy`) | P1 | `frontend-refactorer` | Pending |
| Setup Vitest + RTL test suite | P1 | `qa-auditor` | Pending |
| Extract custom hooks (`useAuth`, `useEvents`) | P1 | `frontend-refactorer` | Pending |
| Deconstruct `EventDetailScreen.tsx` | P1 | `frontend-refactorer` | Pending |
| Beer wishlist / "Want to try" toggle | P1 | `frontend-refactorer` | Pending |
| Dietary badges (Vegan, Gluten-Free) | P1 | `beer-catalog-manager` | Pending |
