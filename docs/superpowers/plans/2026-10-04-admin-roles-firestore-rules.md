# Admin Roles & Firestore Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded admin email with a Firestore-backed admin role and add `firestore.rules` that enforce admin/owner permissions server-side.

**Architecture:** A `useIsAdmin(user)` hook subscribes to `admins/{uid}`; `App.tsx` uses it and passes `isAdmin` to `AdminScreen`. A new `firestore.rules` (plus minimal `firebase.json`) gates `admins`, `users`, `locations` and `events` using an `isAdmin()` rule helper that checks for the same document.

**Tech Stack:** React 19, TypeScript (strict), Firebase v12 (`onSnapshot`, `doc`), Firestore security rules.

**Spec:** `docs/superpowers/specs/2026-10-04-admin-roles-firestore-rules-design.md`

## Global Constraints

- No `any`; domain types stay in `src/types.ts`; no hardcoded hex colours (spec: project rules in `AGENTS.md`).
- The string `srafferty89@gmail.com` must not remain anywhere under `src/`.
- Admin docs live at `admins/{uid}`; clients may read only their own; nobody may write (spec: Role storage).
- `events/{id}` updates by any signed-in user must stay allowed (spec: Non-goals).
- Rules must permit the client query `where('isPublic', '==', true)` on `users` (spec: firestore.rules).
- Rollout order: create admin doc, deploy client, deploy rules (spec: Rollout order).
- There is no test runner in this repo and none is added here. Verification gate is `npm run lint` and `npm run build`; rules are verified manually after rollout.

## Review Focus

- Signed-out or loading user: `useIsAdmin` returns `false`, never throws, no stale `true` after sign-out/switching accounts.
- `admins/{uid}` read fails (rules not yet deployed, offline): hook returns `false` and logs, admin UI stays hidden.
- Rules locked-out admin: admin doc missing when rules deploy blocks `/locations` writes (rollout order in Task 2 docs).
- Client `users` query vs rule: query with `where('isPublic','==',true)` must satisfy `resource.data.isPublic == true`; reading own doc must still work for private users.
- Legacy data: events without `userId` deletable by admin only; users without `isPublic` unreadable by others.

---

### Task 1: Firestore-backed admin check in the client

**Files:**
- Create: `src/hooks/useIsAdmin.ts`
- Modify: `src/App.tsx` (import, line ~514 `isAdmin`, `<AdminScreen>` at ~838)
- Modify: `src/components/AdminScreen.tsx` (remove `ADMIN_EMAIL` at line 21 and `isAdmin` at line 58; add prop)

**Interfaces:**
- Produces: `useIsAdmin(user: User | null): boolean`
- Produces: `AdminScreen` prop `isAdmin: boolean`

- [ ] **Step 1: Create the hook**

```ts
// src/hooks/useIsAdmin.ts
import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * True when `admins/{uid}` exists for the signed-in user.
 * Server-side Firestore rules enforce the same check; this only drives the UI.
 */
export function useIsAdmin(user: User | null): boolean {
  const [adminUid, setAdminUid] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    const unsubscribe = onSnapshot(
      doc(db, 'admins', uid),
      (snap) => setAdminUid(snap.exists() ? uid : null),
      (err) => {
        console.error('Failed to read admin role:', err);
        setAdminUid(null);
      }
    );
    return () => unsubscribe();
  }, [user]);

  // Tying the flag to the uid prevents a stale `true` after switching accounts or signing out
  return !!user && adminUid === user.uid;
}
```

- [ ] **Step 2: Use it in `App.tsx`**

Add the import next to the other local imports:

```ts
import { useIsAdmin } from './hooks/useIsAdmin';
```

Replace line ~514:

```ts
const isAdmin = user?.email?.toLowerCase() === 'srafferty89@gmail.com';
```

with:

```ts
const isAdmin = useIsAdmin(user);
```

Hooks must run before any early return in `App`. If `App` has an early `return` above this line (e.g. for `authLoading`), move this one line up to sit with the other hooks near the top of the component instead, and keep `canDeleteEvent` (which references `isAdmin`) below it.

Pass it to `AdminScreen`:

```tsx
<AdminScreen
  user={user}
  isAdmin={isAdmin}
  locations={locations}
  onBack={() => setShowAdmin(false)}
  onSaveLocation={handleSaveLocation}
  onDeleteLocation={handleDeleteLocation}
/>
```

- [ ] **Step 3: Update `AdminScreen.tsx`**

Delete `const ADMIN_EMAIL = 'srafferty89@gmail.com';` and the line `const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL;`. Add `isAdmin: boolean;` to `AdminScreenProps` and `isAdmin,` to the destructured props. If `user` is no longer used in the component, remove it from the props and from the `<AdminScreen>` call in `App.tsx`.

- [ ] **Step 4: Verify**

Run: `grep -rn "srafferty89" src/` — expected: no output.
Run: `npm run lint && npm run build` — expected: both succeed (the pre-existing 500 kB chunk warning is fine).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useIsAdmin.ts src/App.tsx src/components/AdminScreen.tsx
git commit -m "feat: read admin role from Firestore instead of hardcoded email"
```

---

### Task 2: Firestore rules, Firebase config and docs

**Files:**
- Create: `firestore.rules`
- Create: `firebase.json`
- Modify: `README.md` (Step 4 rules section, ~line 200-215)
- Modify: `CLAUDE.md` (architecture note about no `firestore.rules`; admin gotcha)
- Modify: `TODO.md` (admin item + tracker row)

**Interfaces:**
- Consumes: `admins/{uid}` document convention from Task 1.

- [ ] **Step 1: Create `firestore.rules`**

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return isSignedIn()
        && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }

    // Admin role documents: created manually in the console, never by clients.
    match /admins/{uid} {
      allow get: if isSignedIn() && request.auth.uid == uid;
      allow list, write: if false;
    }

    // Profiles: own doc, or any public profile (the client queries isPublic == true).
    match /users/{uid} {
      allow read: if isSignedIn()
        && (request.auth.uid == uid || resource.data.isPublic == true);
      allow create, update: if isSignedIn() && request.auth.uid == uid;
      allow delete: if false;
    }

    // Event venues: any signed-in user can read, only admins can change.
    match /locations/{locationId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    // Events embed drinks, reviews and attendees, so any signed-in user may update.
    match /events/{eventId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn() && request.resource.data.userId == request.auth.uid;
      allow update: if isSignedIn();
      allow delete: if isSignedIn()
        && (isAdmin() || resource.data.userId == request.auth.uid);
    }
  }
}
```

- [ ] **Step 2: Create `firebase.json`**

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "storage": {
    "rules": "storage.rules"
  }
}
```

- [ ] **Step 3: Replace the README rules example**

In `README.md` Step 4, replace the inline example block with:

````markdown
### Step 4: Deploy Firestore Security Rules
Rules live in `firestore.rules` (and `storage.rules` for Cloud Storage). Admins are identified by a document at `admins/<their Firebase Auth uid>`.

**Order matters:**
1. In the Firebase console (Firestore Database), create a collection `admins` with a document whose ID is your Auth uid (Authentication > Users). It needs no fields.
2. Deploy the app build.
3. Deploy the rules: `firebase deploy --only firestore:rules,storage`

Deploying the rules before step 1 locks you out of admin-only writes (locations).
````

- [ ] **Step 4: Update `CLAUDE.md` and `TODO.md`**

In `CLAUDE.md`: in the Images paragraph, change "There is no `firestore.rules` file in the repo." to "Firestore rules are in `firestore.rules`." and replace the first Known-gotchas bullet (hardcoded admin email) with: "Admin status is the existence of `admins/{uid}` (read by `src/hooks/useIsAdmin.ts`, enforced in `firestore.rules`). Admin docs are created manually in the Firebase console."

In `TODO.md`: change `- [ ] **[P1] Client-Only Hardcoded Admin Credentials**` to `- [x] ...`, and set the tracker row `Add server-side firestore.rules` to `Completed`.

- [ ] **Step 5: Verify**

Run: `npm run lint && npm run build` — expected: both succeed.
Run: `grep -rn "srafferty89" src/ CLAUDE.md` — expected: no output.
Rules can't be validated locally in this repo (no emulator setup). If `firebase-tools` is available, optionally run `npx firebase-tools@latest deploy --only firestore:rules --dry-run` for a syntax check and report the result; otherwise say it was not run.

- [ ] **Step 6: Commit**

```bash
git add firestore.rules firebase.json README.md CLAUDE.md TODO.md
git commit -m "feat: add Firestore security rules with Firestore-backed admin role"
```

---

## Manual verification after rollout (user performs; not automatable here)

1. Admin account: admin button visible, location create/edit/delete works.
2. Non-admin account: no admin button; a console `deleteDoc` on a location fails with permission denied.
3. Deleting an event created by another user fails; deleting your own works.
4. A private user's `users` doc is unreadable by others; friend search still lists public users.

## Self-review notes

- Spec coverage: role storage (Task 1 hook + Task 2 rules `admins`), client hook/prop (Task 1), rules table (Task 2 Step 1), `firebase.json` (Step 2), rollout order (Step 3 README), limits and verification (manual section).
- Type consistency: `useIsAdmin(user: User | null): boolean` and `AdminScreen` prop `isAdmin: boolean` are used identically in both tasks.
