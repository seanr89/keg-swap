---
name: component-refactoring
description: >-
  Guidelines and step-by-step procedures for decomposing monolithic React 19 components in Keg Swap, extracting custom hooks (useAuth, useEvents, useLocations), implementing code-splitting with React.lazy to reduce the 860KB bundle size, and maintaining CSS variable design tokens.
---

# Component Refactoring & Performance Guide for Keg Swap

This skill guides engineers and agents in decomposing large React components and optimizing Keg Swap's bundle.

---

## 1. Problem Statement & Architecture Goals

Current codebase metrics:
- `src/App.tsx`: ~980 lines (manages auth, routing, events, locations, users, modals, consent).
- `src/components/EventDetailScreen.tsx`: ~1,150 lines (manages beer CRUD, filters, reviews modal, lightbox, batch upload).
- Vite build warning: `dist/assets/index-*.js` is **861 kB**, exceeding the 500 kB recommended chunk threshold.

### Architectural Objectives:
1. Break down `App.tsx` by extracting stateful hooks.
2. Deconstruct `EventDetailScreen.tsx` into dedicated child components:
   - `DrinkList.tsx`: Drinks listing and virtual scroll / card rendering.
   - `DrinkCard.tsx`: Individual beer card with review drawer.
   - `ReviewModal.tsx`: Viewport dialog portal for ratings & review submission.
   - `DrinkFormModal.tsx`: Drink creation and editing dialog.
   - `BatchUploadModal.tsx`: Drag-and-drop batch JSON uploader.
   - `ImageLightbox.tsx`: Reusable image viewer.
3. Code-split heavy views (`AdminScreen`, `UserProfileScreen`, `EventDetailScreen`) using `React.lazy` and `Suspense`.

---

## 2. Custom Hook Extraction Patterns

### `useAuth` Hook (`src/hooks/useAuth.ts`)
```typescript
import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { UserProfile } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    const docRef = doc(db, 'users', user.uid);
    return onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        setProfile(snapshot.data() as UserProfile);
      }
    });
  }, [user]);

  return { user, profile, loading, isAdmin: user?.email?.toLowerCase() === 'srafferty89@gmail.com' };
}
```

### `useEvents` Hook (`src/hooks/useEvents.ts`)
Encapsulates real-time Firestore synchronization for events and action dispatches (`addEvent`, `deleteEvent`, `updateStatus`, `addDrink`, `addReview`).

---

## 3. Code-Splitting & Bundle Reduction Pattern

In `src/App.tsx`, dynamically import views that are not immediately needed on initial page load:

```typescript
import React, { lazy, Suspense } from 'react';

// Lazy load non-critical screen components
const AdminScreen = lazy(() => import('./components/AdminScreen').then(m => ({ default: m.AdminScreen })));
const UserProfileScreen = lazy(() => import('./components/UserProfileScreen').then(m => ({ default: m.UserProfileScreen })));
const EventDetailScreen = lazy(() => import('./components/EventDetailScreen').then(m => ({ default: m.EventDetailScreen })));

// In JSX:
{showAdmin && (
  <Suspense fallback={<div className="loading-spinner">Loading Admin Panel...</div>}>
    <AdminScreen ... />
  </Suspense>
)}
```

---

## 4. Styling Conventions
- Always consume design tokens defined in `src/index.css`:
  - Backgrounds: `var(--bg-main)`, `var(--bg-card)`, `var(--bg-card-hover)`.
  - Accents: `var(--primary)`, `var(--primary-hover)`, `var(--primary-glow)`.
  - Typography: `var(--text-primary)`, `var(--text-secondary)`, `var(--text-muted)`.
- Respect both Light and Dark themes. Never hardcode static hex codes for surfaces in component CSS.
- Ensure light-dismiss attributes (`closedby="any"`) on native `<dialog>` elements have JS backdrop-click fallbacks for Safari compatibility.
