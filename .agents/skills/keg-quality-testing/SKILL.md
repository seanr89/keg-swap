---
name: keg-quality-testing
description: >-
  Testing runbook and verification workflows for Keg Swap. Covers configuring and running Vitest, testing React 19 components (StarRating, EventCard gestures, dialog light-dismiss), mocking Firebase Auth/Firestore, and running quality gates.
---

# Keg Quality & Testing Guide for Keg Swap

This skill defines the testing strategy, mock conventions, and automated quality gates for Keg Swap.

---

## 1. Quality Gates & Verification Commands

Before submitting code or pushing commits, execute the following verification steps:

```bash
# 1. Fast Linting Check
npm run lint

# 2. TypeScript Compilation & Production Bundle Check
npm run build
```

---

## 2. Setting Up Vitest & React Testing Library

To add automated unit and component testing to the project:

### Package Dependencies:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

### `vite.config.ts` Configuration:
```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
```

---

## 3. Key Test Targets & Scenarios

1. **`StarRating.tsx`**:
   - Verify hover and click behavior on both full and half beer glass targets.
   - Ensure 0.5 to 10.0 ratings trigger `onChange` with correct floating values.
2. **`EventCard.tsx`**:
   - Verify touch swipe gesture transitions: swipe left to reveal delete drawer, tap outside to snap back.
   - Verify status dropdown changes trigger `onStatusChange`.
   - Ensure delete button triggers a confirmation dialog before permanent deletion.
3. **`EventModal.tsx`**:
   - Form validation: submitting empty fields should display inline error borders and messages.
   - Multi-day event toggle: displaying and validating `endDate >= date`.
4. **`AuthScreen.tsx`**:
   - Mapping Firebase error codes (`auth/invalid-credential`, `auth/email-already-in-use`) to user-friendly messages.

---

## 4. Firebase Mocking Convention

Use mock modules for `src/firebase.ts` during testing:
```typescript
vi.mock('../firebase', () => ({
  auth: {
    currentUser: { uid: 'test-user-1', email: 'tester@kegswap.local', displayName: 'Test Ale Lover' },
  },
  db: {},
}));
```
