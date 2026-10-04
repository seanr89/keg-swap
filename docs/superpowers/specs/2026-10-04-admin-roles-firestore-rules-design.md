# Admin roles and Firestore security rules — design

## Problem
Admin access is decided on the client by comparing the signed-in email to a hardcoded
string (`isAdmin` in `src/App.tsx`, `ADMIN_EMAIL` in `src/components/AdminScreen.tsx`).
There is no `firestore.rules`, so any signed-in user can bypass the UI and write or delete
anything with the Firebase SDK, including `/locations` and any event.

## Goal
- Admin status comes from data, not source code.
- Firestore enforces admin-only and owner-only operations server-side.
- The hardcoded email is removed from the client.

## Non-goals
- Firebase Auth custom claims. They can only be set from a backend (Admin SDK) and this repo has none.
- Moving drinks/reviews to subcollections (separate P1 item). Until then `events/{id}` updates
  by any signed-in user must stay allowed, because drinks, reviews, attendees and status are all
  fields on that document.

## Design

### Role storage
Collection `admins`, one document per admin, id = Firebase Auth uid (fields are not read).
Created manually in the Firebase console. Clients can read only their own doc; nobody can write it.

### Client
- New hook `src/hooks/useIsAdmin.ts`: subscribes to `admins/{user.uid}` and returns `exists()`.
  Returns `false` while loading and when signed out or on error.
- `App.tsx` replaces the email comparison with the hook; `AdminScreen` receives `isAdmin` as a prop
  and drops `ADMIN_EMAIL`.
- Existing UI gating (admin button, `canDeleteEvent`) is unchanged otherwise.

### `firestore.rules` (new) and `firebase.json` (new, minimal)
`firebase.json` points `firestore.rules` and the existing `storage.rules`.

| Path | read | write |
| :--- | :--- | :--- |
| `admins/{uid}` | own doc | none |
| `users/{uid}` | own doc, or `isPublic == true` | create/update own doc only (`request.auth.uid == uid`); no delete |
| `locations/{id}` | signed in | admin only |
| `events/{id}` | signed in | create: signed in and `userId == auth.uid`; update: signed in; delete: `userId == auth.uid` or admin |

`isAdmin()` helper: `exists(/databases/$(database)/documents/admins/$(request.auth.uid))`.
The `users` read rule is written so the client query `where('isPublic', '==', true)` is permitted.

### Known limits
- Any signed-in user can still update any event document (needed by the embedded-array model).
- Legacy events without `userId` are deletable by admins only, matching the client.
- Legacy user docs without `isPublic` are no longer readable by other users.
- Rules are not covered by automated tests; there is no emulator setup in the repo.

## Rollout order (matters)
1. In the Firebase console, create `admins/<your uid>` (uid from Authentication > Users).
2. Deploy the client build (admin UI now keys off that doc).
3. Deploy rules: `firebase deploy --only firestore:rules`.
Deploying rules before step 1 locks the admin out of `/locations` writes.

## Verification
- `npm run lint`, `npm run build`.
- Manual, after rollout: admin sees admin UI; a non-admin does not; a non-admin SDK write to
  `locations` is rejected; deleting another user's event is rejected; a private user's doc is
  not readable by others.
