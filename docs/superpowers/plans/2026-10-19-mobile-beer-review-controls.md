# Mobile-Friendly Beer Review Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a mobile-first, thumb-zone-optimized review experience in Keg Swap featuring a tactile 0.5–10.0 rating scrubber, bottom sheet dialog with swipe-to-dismiss gestures, visual serving format pills, categorized flavor tag drawer, and auto-expanding notes with quick impressions.

**Architecture:** Deconstruct the inline review form from `EventDetailScreen.tsx` into modular components under `src/components/review/` (`ReviewBottomSheet.tsx`, `RatingScrubber.tsx`, `ServingFormatSelector.tsx`, `TastingTagPicker.tsx`, `TastingNotesInput.tsx`, `ReviewPhotoControl.tsx`) driven by a clean `useReviewDraft` hook. Preserves `StarRating.tsx` for static displays.

**Tech Stack:** React 19, TypeScript, CSS Custom Properties, Firebase Firestore modular SDK, Lucide React.
Verification gates: `npm run lint` and `npm run build` after every task.

**Spec:** `docs/superpowers/specs/2026-10-19-mobile-beer-review-controls-design.md`

---

## Global Constraints

- Strict TypeScript (`noImplicitAny`, no `any`). Models centralized in `src/types.ts`.
- Zero hardcoded hex colors; strictly use CSS custom properties (`var(--primary)`, `var(--bg-card)`, `var(--text-primary)`, `var(--border-color)`).
- WCAG 2.2 AA target size compliance: all interactive touch targets must be at least 44×44px (or minimum 24×24px with adequate spacing per 2.5.8).
- Zero-zoom rule: all text inputs must have `font-size: 16px` minimum to prevent iOS Safari auto-zoom.
- Modern `<dialog closedby="any">` with fallback JS backdrop dismiss.
- Verification gate for every task: `npm run lint` and `npm run build`.

---

## Component Layout & Responsibilities

| File | Type | Responsibility |
| :--- | :--- | :--- |
| `src/components/review/RatingScrubber.tsx` | New Component | 0.5–10.0 continuous touch slider with snapping, dynamic sentiment badge, stepper buttons `[-]` / `[+]`, and quick rating pills `[ 5.0 ] [ 7.0 ] [ 8.0 ] [ 8.5 ] [ 9.0 ]`. |
| `src/components/review/ServingFormatSelector.tsx` | New Component | Quick-tap format chips (`Pint`, `Half`, `1/3`, `Can`, `Bottle`, `Flight/Sample`, `Other`) and formatted price input with `inputmode="decimal"`. |
| `src/components/review/TastingTagPicker.tsx` | New Component | Sensory category tabs (Hops & Fruit, Malt & Dark, Yeast & Finish) with 40px tag chips and inline custom tag creation. |
| `src/components/review/TastingNotesInput.tsx` | New Component | Auto-expanding textarea with quick-impression 1-tap pills (`Juicy & tropical`, `Crisp & clean`, etc.). |
| `src/components/review/ReviewPhotoControl.tsx` | New Component | Camera snap button (`capture="environment"`), WebP compression, thumbnail preview card. |
| `src/components/review/ReviewBottomSheet.tsx` | New Component | Dialog wrapper, top drag-handle, swipe-down dismiss touch gesture, safe-area inset, keyboard avoidance. |
| `src/hooks/useReviewDraft.ts` | New Hook | State management, local storage draft recovery, Firestore review submission, validation. |
| `src/components/EventDetailScreen.tsx` | Modify | Remove 280 lines of inline review JSX; delegate to `ReviewBottomSheet` and enhance mobile `BeerDrinkCard` CTA button. |
| `src/App.css` | Modify | Styles for bottom sheet, scrubber, pill selectors, and mobile touch targets. |

---

## Tasks

### Task 1: RatingScrubber Component & Touch Tracking

**Files:**
- Create: `src/components/review/RatingScrubber.tsx`
- Modify: `src/App.css` (rating scrubber styles)

- [ ] **Step 1: Implement RatingScrubber component**
  - Implement 0.5 to 10.0 scale slider with 0.5 snapping.
  - Implement touch/pointer events (`onPointerDown`, `onPointerMove`, `onPointerUp`) with `setPointerCapture`.
  - Add sentiment text helper:
    - 0.5–2.5: "Flawed / Undrinkable"
    - 3.0–4.5: "Below Average"
    - 5.0–6.5: "Solid / Average"
    - 7.0–8.0: "Great / Very Good"
    - 8.5–9.0: "Outstanding"
    - 9.5–10.0: "World Class"
  - Add stepper buttons `[-]` and `[+]` (44×44px).
  - Add quick preset pills: `[ 5.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 10.0 ]`.
  - Add subtle haptic vibration tick `if (navigator.vibrate) navigator.vibrate(8)` on change.
  - Full ARIA attributes (`role="slider"`, `aria-valuenow`, `aria-valuemin="0.5"`, `aria-valuemax="10.0"`, `aria-valuetext`).

- [ ] **Step 2: Add styles to `src/App.css`**
  - Track styling with gradient progress fill.
  - Thumb knob with 44px hit-box and active state pulse.
  - Light/Dark theme token compatibility.

- [ ] **Step 3: Verification Gate**
  - Run `npm run lint` and `npm run build`.

---

### Task 2: Sub-Controls (Serving Format, Flavor Tags, Notes & Photo)

**Files:**
- Create: `src/components/review/ServingFormatSelector.tsx`
- Create: `src/components/review/TastingTagPicker.tsx`
- Create: `src/components/review/TastingNotesInput.tsx`
- Create: `src/components/review/ReviewPhotoControl.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Implement ServingFormatSelector**
  - Format chips: `Pint`, `Half Pint`, `Third Pint`, `Can`, `Bottle`, `Flight / Sample`, `Other`.
  - Price field with `inputmode="decimal"`, currency prefix `£`, and quick-tap price presets `[ £3.50, £4.50, £5.50, £6.50 ]`.

- [ ] **Step 2: Implement TastingTagPicker**
  - Categorized sensory tabs: `All`, `Hops & Fruit`, `Malt & Dark`, `Yeast & Finish`.
  - Chip toggle with checkmark indicator and 8-tag limit enforcement.
  - Integrated custom tag input utilizing `src/utils/tastingTags.ts`.

- [ ] **Step 3: Implement TastingNotesInput**
  - Auto-growing textarea with `field-sizing: content;`.
  - 1-tap quick impression chips: `[ "Juicy & tropical", "Crisp, clean finish", "Heavy roasty bitterness", "Smooth creamy mouthfeel", "Pleasant tart acidity" ]`.
  - Character counter and clear button.

- [ ] **Step 4: Implement ReviewPhotoControl**
  - Large camera button with `capture="environment"`.
  - Canvas WebP compression via `src/utils/imageUtils.ts`.
  - Thumbnail preview card with Retake and Remove actions.

- [ ] **Step 5: Verification Gate**
  - Run `npm run lint` and `npm run build`.

---

### Task 3: Bottom Sheet Dialog & Gesture Engine

**Files:**
- Create: `src/hooks/useReviewDraft.ts`
- Create: `src/components/review/ReviewBottomSheet.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Implement `useReviewDraft` hook**
  - Encapsulate form state: `rating`, `servingSize`, `price`, `tags`, `comment`, `imageUrl`.
  - Draft recovery: Cache in `sessionStorage` and restore if reopened.
  - Submission handler: Cleans tags, triggers Firestore write to `events/{eventId}/drinks/{drinkId}/reviews/{reviewId}`.

- [ ] **Step 2: Implement `ReviewBottomSheet` component**
  - Native `<dialog className="review-bottom-sheet" closedby="any">`.
  - Pull-to-dismiss drag handle with pointer event gesture tracking (drag down > 100px triggers dismiss).
  - Safe-area bottom padding for iPhone home indicator.
  - Sticky bottom action bar with high-contrast `Submit Review` CTA and `Cancel` button.

- [ ] **Step 3: Verification Gate**
  - Run `npm run lint` and `npm run build`.

---

### Task 4: Integration into EventDetailScreen & Drink Card Polish

**Files:**
- Modify: `src/components/EventDetailScreen.tsx`
- Modify: `src/App.css`
- Modify: `TODO.md`

- [ ] **Step 1: Refactor `EventDetailScreen.tsx`**
  - Replace legacy `#add-review-dialog` markup (lines 945–1225) with `<ReviewBottomSheet />`.
  - Clean up unused review form state in `EventDetailScreen.tsx`.
  - Update `BeerDrinkCard`:
    - On mobile (`<= 600px`), display prominent primary action pill: `[ ⭐ Rate & Review ]`.
    - If already reviewed by current user, show: `[ ⭐ You rated: X.X/10 • Edit ]`.

- [ ] **Step 2: Update `TODO.md`**
  - Mark mobile beer review controls item as completed/in progress.

- [ ] **Step 3: Verification Gate**
  - Run `npm run lint` and `npm run build`.
  - Test simulated mobile viewports (360px, 375px, 390px, 412px).
