---
name: firebase-data-architecture
description: >-
  Best practices, schema guidelines, security rules, and data migration procedures for Keg Swap's Firebase Auth, Firestore, and Storage architecture. Use this skill when modifying database operations, creating Firestore security rules, managing image uploads, or handling user privacy and indexing.
---

# Firebase Data Architecture & Security Guide for Keg Swap

This skill provides operational procedures and architecture standards for managing Firebase in Keg Swap.

---

## 1. Critical Firestore Constraints & Image Storage

### The 1MB Document Size Limit Issue
- In Firestore, the hard document limit is **1,048,576 bytes (1MB)**.
- `src/utils/imageUtils.ts` currently generates base64 data URLs (`data:image/jpeg;base64,...`) from user uploads.
- When reviews and drinks with base64 images are embedded directly into a single `BeerEvent` document (`events/{eventId}`), a popular event with several beers and photo reviews will exceed the 1MB limit, resulting in silent writes or `FirebaseError: Document size exceeds maximum allowed size`.

### Recommended Remediation Architecture
1. **Firebase Storage Integration**:
   - Store uploaded beer and review images in Firebase Storage under:
     - `events/{eventId}/drinks/{drinkId}.jpg`
     - `events/{eventId}/reviews/{reviewId}.jpg`
   - Store only the returned HTTPS download URL string in the Firestore document.
2. **Subcollection Architecture**:
   - If an event has hundreds of reviews and drinks, migrate from embedded arrays to subcollections:
     - `/events/{eventId}/drinks/{drinkId}`
     - `/events/{eventId}/drinks/{drinkId}/reviews/{reviewId}`
   - This keeps individual document sizes minimal and prevents reading all drink reviews upfront.

---

## 2. Firestore Security Rules (`firestore.rules`)

Keg Swap requires server-enforced security rules. Do not rely exclusively on client-side checks (e.g. `isAdmin = user.email === '...'`).

Create and maintain `firestore.rules` in the repository root:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    function isAdmin() {
      return isAuthenticated() && 
        (request.auth.token.admin == true || 
         request.auth.token.email.lower() == 'srafferty89@gmail.com');
    }

    // Events collection
    match /events/{eventId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      // Only the event creator or an admin can update or delete events
      allow update: if isAuthenticated();
      allow delete: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
    }

    // Locations collection (Admin only for write/delete)
    match /locations/{locationId} {
      allow read: if isAuthenticated();
      allow write, delete: if isAdmin();
    }

    // Users collection
    match /users/{userId} {
      // Allow reading user document if public, or if it's the user themselves
      allow read: if isAuthenticated() && (resource.data.isPublic == true || request.auth.uid == userId);
      // Only the user themselves can modify their profile
      allow write: if isOwner(userId);
    }
  }
}
```

---

## 3. Privacy-Preserving User Queries

### The Anti-Pattern: Unfiltered All-User Listener
Avoid querying the entire `users` collection in `App.tsx`:
```typescript
// ❌ Unbounded and leaks private users
const usersColRef = collection(db, 'users');
onSnapshot(usersColRef, ...);
```

### The Correct Pattern: Filtered Public Query
```typescript
// ✅ Only sync public profiles for friend search
const publicUsersQuery = query(
  collection(db, 'users'),
  where('isPublic', '==', true)
);
onSnapshot(publicUsersQuery, (snapshot) => {
  const users = snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
  setPublicUsers(users);
});
```

---

## 4. Verification Checklist
- [ ] No base64 image strings > 20KB stored directly in Firestore document fields.
- [ ] Security rules tested locally using Firebase Emulator Suite: `firebase emulators:start --only firestore`.
- [ ] Compound indexes configured in `firestore.indexes.json` when chaining `where()` and `orderBy()`.
- [ ] Destructive actions (`deleteDoc`) authenticated and authorized on both client and rules levels.
