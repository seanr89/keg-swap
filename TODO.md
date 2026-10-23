# Keg Swap 🍺 — Project Roadmap & Task Backlog (`TODO.md`)

This document tracks active feature additions, testing requirements, code quality tasks, and component decomposition for the **Keg Swap** application.

---

## 🚦 Priority Legend
- `[P0]` **Blocker / Security / Data Loss Risk:** Must be resolved immediately before scaling production traffic.
- `[P1]` **High Priority:** Major UX friction, privacy leaks, or bundle/scalability issues.
- `[P2]` **Medium Priority:** Important features, performance optimizations, and code refactoring.
- `[P3]` **Low Priority / Nice to Have:** Quality-of-life enhancements and exploratory ideas.

---

## ✨ 1. Feature Additions & Enhancements

- [ ] **[P2] Social Tasting Feed & Friend Comparison** `firebase-specialist` `frontend-refactorer`
  - Friend activity tab showing real-time reviews from user friends.
  - On beer cards, highlight friends' ratings: *"Sarah rated this 9.0/10"*.

- [ ] **[P3] Query Param Deep Linking** `frontend-refactorer`
  - Support query param deep linking: `?event=<id>&drink=<drinkId>`.
  - Pass the generated deep link as `url` in the two `ShareButton` call sites ([`EventCard.tsx`](file:///Users/seanrafferty/Documents/development/repos/keg-swap/src/components/EventCard.tsx) and [`EventDetailScreen.tsx`](file:///Users/seanrafferty/Documents/development/repos/keg-swap/src/components/EventDetailScreen.tsx)).

---

## 🧪 2. Testing, Quality & CI/CD Enhancements

- [ ] **[P1] Core Unit & Component Test Suite** `qa-auditor`
  - `StarRating.test.tsx`: Verify half-glass and full-glass math (0.5 to 10.0 scale) and keyboard accessibility.
  - `EventModal.test.tsx`: Verify required form fields, invalid dates, and light-dismiss behavior.
  - `EventCard.test.tsx`: Test touch swipe gesture logic, status changes, and deletion confirmations.
  - `AuthScreen.test.tsx`: Test error translations for invalid credentials and password strength.
  - `BatchUploadModal.test.tsx`: Verify batch JSON parsing, record count calculations, duplicate detection, and item exclusions.
  - *(Note: Vitest test runner, jsdom environment, and unit test suites for `batchBeerParser` and `drinkFlags` are active).*

---

## 🏗️ 3. Code Quality & Component Decomposition

- [ ] **[P1] Extract Custom Hooks from `App.tsx`** `frontend-refactorer`
  - Extract `src/hooks/useAuth.ts`: Auth listener, user profile snapshot, admin verification.
  - Extract `src/hooks/useEvents.ts`: Firestore events query, event addition/deletion, status updates.
  - Extract `src/hooks/useLocations.ts`: Firestore locations query and CRUD.

- [ ] **[P1] Deconstruct `EventDetailScreen.tsx` into Child Components** `frontend-refactorer`
  - Continue decomposing `EventDetailScreen.tsx` into modular subcomponents:
    - `DrinkCard.tsx`: Drink item display, rating badge, review toggle.
    - `DrinkFormModal.tsx`: Add/edit beer dialog.
    - `ImageLightbox.tsx`: Fullscreen photo modal.
  - *(Note: `BatchUploadModal.tsx` and `ReviewBottomSheet.tsx` have already been extracted).*

---

## 🚀 4. Deployment Checklist & Pending Operations

- **Deploy Firestore Rules & Storage Rules:**
  - `firestore.rules` and `firestore.indexes.json` contain rules for subcollections (`drinks`, `reviews`), owner-only wishlists (`users/{uid}/wishlists/{eventId}`), and collection-group queries.
  - Deploy command: `firebase deploy --only firestore:rules,firestore:indexes,storage`
  - *Note:* Ensure your admin UID document exists in `/admins/{uid}` before deploying rules that restrict location writes.

---

## 📌 Implementation Progress Tracker

| Task | Priority | Assigned Subagent | Status |
| :--- | :---: | :--- | :---: |
| Core unit & component test suite | P1 | `qa-auditor` | Pending |
| Extract custom hooks (`useAuth`, `useEvents`, `useLocations`) | P1 | `frontend-refactorer` | Pending |
| Deconstruct `EventDetailScreen.tsx` (`DrinkCard`, `DrinkFormModal`) | P1 | `frontend-refactorer` | Pending |
| Social tasting feed & friend comparison | P2 | `firebase-specialist` / `frontend-refactorer` | Backlog |
| Query param deep linking (`?event=&drink=`) | P3 | `frontend-refactorer` | Backlog |
