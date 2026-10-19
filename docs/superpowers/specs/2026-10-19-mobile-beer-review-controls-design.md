# Mobile-Friendly Beer Review Controls & Experience — Design Specification

**Specification ID:** `SPEC-2026-10-19-MOBILE-REVIEW`  
**Target Application:** Keg Swap (Mobile Web & PWA)  
**Status:** Ready for Review  
**Date:** 2026-10-19  
**Authors:** Senior Frontend Architect & UI/UX Specialist  

---

## 1. Problem Statement & Context

### 1.1 Environmental & Real-World Realities
Keg Swap is primarily used at craft beer festivals, taprooms, bottle shares, and crowded pub events. The physical context of a user submitting a review is uniquely constrained:
- **One-Handed Phone Operation:** The user is typically holding a pint glass, tasting tulip, or festival cup in one hand, while operating their phone with their thumb in the other hand.
- **Environmental Distractions:** Dim lighting in cellars/bars, high ambient noise, and potential moisture/stickiness on fingers.
- **Cognitive Load & Speed:** Attendees want to log a drink in under **10 seconds** before returning to conversation. Friction leads directly to review abandonment.

### 1.2 Audit of Current Keg Swap Review Controls
A systematic audit of `src/components/EventDetailScreen.tsx` (lines 945–1225) and `src/components/StarRating.tsx` identifies several critical mobile usability bottlenecks:

| Component Area | Current Implementation | Mobile Usability Bottleneck | WCAG / Ergonomic Violation |
| :--- | :--- | :--- | :--- |
| **Star Rating** | 10 SVG icons rendered horizontally in `StarRating.tsx` | On standard 375px–390px mobile viewports, each beer glass is ~18–24px wide with 2px gap. Half-ratings (0.5 steps) require tapping either the left or right 9–12px of an icon. | Fails **WCAG 2.5.5** (44×44px target) & **2.5.8** (24×24px minimum). High touch error rate. |
| **Rating Adjustment** | Secondary row with `[-0.5]` button, `input[type="range"]`, and `[+0.5]` button | Disjointed controls. The native range slider thumb is small and difficult to scrub accurately across 20 discrete stops (0.5 to 10.0). Step buttons require 8–12 repetitive taps to rate high or low beers. | Poor thumb ergonomics; jarring layout hierarchy. |
| **Review Dialog** | Desktop-styled modal `<dialog className="event-modal-dialog">` | Inline inside a 1,465-line file. While basic media queries exist, it lacks a true mobile-native bottom sheet (no drag handle, no swipe-down dismiss gesture, no safe-area inset protection). | Lacks platform-native tactile feel. Suboptimal keyboard avoidance. |
| **Serving Format** | Standard HTML `<select>` dropdown with 10 options | Requires opening OS-native wheel or bottom picker menu, navigating 10 entries, and confirming. Takes 3–4 taps. | Excessive friction for a 1-tap decision. |
| **Price Entry** | Generic text input without numeric keypad hint | Defaults to standard alphabetical QWERTY keyboard on iOS/Android instead of decimal keypad. | Missing `inputmode="decimal"`. |
| **Flavor Tags** | 16 static preset chips wrapping vertically + text input + button | Consumes huge vertical viewport height. Custom tags require typing, then tapping an adjacent "Add" button. | Exceeds fold; forces heavy scrolling before reaching submit button. |
| **Tasting Notes** | Mandatory textarea (`required`, `minHeight: 100px`) | Forcing a long paragraph at a loud festival causes users to quit. There are no quick impression presets. | High friction / cognitive barrier. |
| **Touch Zones** | Submit button pinned in desktop modal action bar | Primary CTA is placed near bottom, but form content pushes it out of immediate reach if virtual keyboard appears. | Virtual keyboard obscures input fields and CTA. |

---

## 2. Goals & Success Metrics

### 2.1 Core Objectives
1. **Ergonomic "Thumb Zone" Design:** All critical review inputs (rating, format, flavor tags, submission) positioned in the bottom 40–50% of the mobile screen.
2. **Tactile & Precise Rating Scrubber:** Create a mobile-first slider and dial control supporting the 0.5–10.0 scale with smooth touch-drag tracking, 0.5-step snapping, oversized hit targets (≥48px), and optional subtle haptic feedback (`navigator.vibrate`).
3. **Frictionless "10-Second Quick Check-in":** Enable a complete check-in (Rating + Serving Size + 2 Flavor Tags + Optional Quick Impression) in under 10 seconds with zero keyboard typing.
4. **Native-Like Bottom Sheet:** Implement a smooth, responsive bottom sheet modal with pull-to-dismiss gesture, safe-area insets (`env(safe-area-inset-bottom)`), dynamic viewport units (`dvh`), and light-dismiss support.
5. **Component Decomposition:** Decouple the 280 lines of review form JSX out of `EventDetailScreen.tsx` into modular, reusable components under `src/components/review/` adhering to the repository's `component-refactoring` guidelines.
6. **Accessibility Standard:** 100% compliance with WCAG 2.2 AA (target sizes, ARIA slider semantics, screen reader announcements, color contrast in both Light and Dark themes).

### 2.2 Key Performance Indicators (KPIs)
- **Review Completion Time:** Reduced from ~45 seconds to ≤ 10 seconds.
- **Rating Tap Accuracy:** Reduction of accidental mis-taps from ~28% to < 2%.
- **Mobile Drop-off Rate:** Form abandonment during review creation reduced by 50%.
- **Accessibility Score:** 100/100 on Lighthouse / Axe accessibility audits.

---

## 3. Detailed Component & UX Design

```
+-----------------------------------------------------------+
|                      MOBILE SCREEN                        |
|                                                           |
|  [ Beer Card: Northern Monk Faith - 5.4% ]                |
|  [ Tap to Review: Large Primary Pill (⭐ Rate & Review) ]  |
+-----------------------------------------------------------+
                           |
                           v (Smooth slide-up bottom sheet)
+-----------------------------------------------------------+
|                   REVIEW BOTTOM SHEET                     |
|                                                           |
|                   [==== DRAG HANDLE ====]                 |
|                                                           |
|  Reviewing Northern Monk Faith (5.4% Hazy Pale Ale)   [X] |
|                                                           |
|  +-----------------------------------------------------+  |
|  |                TACTILE RATING DISPLAY               |  |
|  |                 [ 8.5 / 10 ]                        |  |
|  |          "Outstanding • Standout Brew"              |  |
|  |                                                     |  |
|  |   [-]  ====(========O=========)====  [+]            |  |
|  |  0.5                                 10.0           |  |
|  |                                                     |  |
|  |  Quick Presets: [ 5.0 ] [ 7.0 ] [ 8.0 ] [ 8.5 ] [ 9.0] |
|  +-----------------------------------------------------+  |
|                                                           |
|  SERVING FORMAT:                                          |
|  [ Pint 🍺 ]  [ Half 🍻 ]  [ 1/3 🥛 ]  [ Can 🥫 ] [ + ]   |
|                                                           |
|  PRICE (OPTIONAL):                                        |
|  [ £ | 5.50 ]     Quick: [ £3.50 ] [ £4.50 ] [ £5.50 ]    |
|                                                           |
|  FLAVOR DESCRIPTORS (Pick up to 8):                       |
|  Filter: [ Hops & Fruit ] [ Malt & Dark ] [ Yeast/Finish ]|
|  (✔ Hoppy)  (✔ Citrus)  ( Tropical )  ( Piney )  ( Crisp )|
|                                                           |
|  QUICK IMPRESSIONS (Optional 1-Tap Notes):                |
|  [ "Super juicy" ] [ "Crisp & refreshing" ] [ "Heavy hop" ]
|                                                           |
|  PHOTO ATTACHMENT:                                        |
|  [ 📷 Take Photo / Choose File ]  [ Paste Image Link ]     |
|                                                           |
|  +-----------------------------------------------------+  |
|  | [ Cancel ]           [ ✔ Submit Review (8.5/10) ]   |  |
|  +-----------------------------------------------------+  |
+-----------------------------------------------------------+
```

---

### 3.1 Mobile Rating Control: `RatingScrubber.tsx`

The core component replacing the cramped 10-glass row in interactive mode.

#### A. Dual-Mode Visual Layout
1. **Dynamic Score Badge & Qualitative Descriptor:**
   - Large, prominent numerical score badge: `8.5` in bold amber text (`font-size: 28px`, `font-weight: 800`).
   - Qualitative sentiment indicator that adapts in real-time as the slider moves:
     - `0.5 – 2.5`: "Flawed / Undrinkable" (Crimson `#ef4444`)
     - `3.0 – 4.5`: "Below Average / Meh" (Orange `#f97316`)
     - `5.0 – 6.5`: "Solid / Sessionable" (Warm Amber `#f59e0b`)
     - `7.0 – 8.0`: "Great / Very Good" (Golden Honey `#ca8a04`)
     - `8.5 – 9.0`: "Outstanding / Standout" (Bright Gold `#eab308`)
     - `9.5 – 10.0`: "World Class / Masterpiece" (Glowing Amber with beer spark icon)
2. **Touch-First Slider Track:**
   - Track height: 12px with rounded pill ends and subtle gradient fill matching the current score.
   - Thumb target: Oversized 36px circular knob with 48×48px invisible touch padding (`touch-action: none`).
   - Touch drag handles pointer events (`onPointerDown`, `onPointerMove`, `onPointerUp`) with `setPointerCapture` to ensure smooth scrubbing even if the finger wanders slightly above or below the track.
   - Stepping: Discrete snapping to 0.5 intervals with micro-haptic tick (`navigator.vibrate(5)` if supported).
3. **Flanking Stepper Buttons:**
   - Left `[-]` and Right `[+]` tactile buttons (44×44px minimum touch target).
   - Long-press or rapid tapping allows fine-tuning without sliding.
4. **Quick Rating Pill Presets:**
   - A horizontal row of quick-tap pills for common craft beer ratings:
     `[ 5.0 ] [ 6.5 ] [ 7.0 ] [ 7.5 ] [ 8.0 ] [ 8.5 ] [ 9.0 ] [ 10 ]`
   - Single tap immediately snaps the slider and score.

#### B. Accessibility & ARIA Contract
```tsx
<div
  role="slider"
  aria-label="Beer rating"
  aria-valuemin={0.5}
  aria-valuemax={10.0}
  aria-valuenow={rating}
  aria-valuetext={`${rating.toFixed(1)} out of 10 beer glasses, ${getSentimentLabel(rating)}`}
  tabIndex={0}
  onKeyDown={handleKeyDown} // ArrowLeft/ArrowDown: -0.5, ArrowRight/ArrowUp: +0.5, Home: 0.5, End: 10
/>
```

---

### 3.2 Mobile Bottom Sheet Dialog: `ReviewBottomSheet.tsx`

#### A. Dialog Architecture
- Replaces standard desktop modal styling on viewports `<= 640px` with a platform-native bottom sheet:
  - Container uses native HTML `<dialog>` with `closedby="any"` (enabling light-dismiss on modern browsers) and manual backdrop click listener fallback for legacy browsers.
  - Position: `fixed; bottom: 0; left: 0; right: 0; width: 100%;`
  - Dimensions: `max-height: 90dvh; max-height: 90vh;` using dynamic viewport units (`dvh`) to automatically avoid virtual keyboards and OS browser address bars.
  - Border radius: `24px 24px 0 0` with box shadow `0 -10px 25px rgba(0,0,0,0.3)`.
  - Safe Area: `padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px))`.

#### B. Touch-Dismiss Gesture (Pull to Close)
- Top Drag Handle: A centered 40×4px pill (`background: var(--text-muted); opacity: 0.4; border-radius: 2px; margin: 8px auto 16px auto; cursor: grab;`).
- Swipe Physics:
  - Pointer down on sheet header or handle tracks vertical delta `deltaY`.
  - If `deltaY > 0` (dragging downwards), translate sheet smoothly: `transform: translateY(${deltaY}px)`.
  - Velocity threshold: If dragged down `> 100px` or released with downwards velocity `> 0.5 px/ms`, trigger close animation and dismiss.
  - Otherwise, spring back to `translateY(0)` with CSS spring transition (`cubic-bezier(0.16, 1, 0.3, 1)`).

#### C. Keyboard Avoidance & Scroll Containment
- `overscroll-behavior: contain;` prevents page scrolling when the user reaches top/bottom of sheet.
- Form inputs feature `scroll-margin-bottom: 80px` to guarantee that focusing an input scrolls it well clear of the virtual keyboard.
- The action buttons (`Submit` / `Cancel`) are pinned to the bottom of the sheet with `position: sticky; bottom: 0;` and a frosted glass backdrop (`backdrop-filter: blur(12px)`).

---

### 3.3 Serving Format & Price Quick-Selector: `ServingFormatSelector.tsx`

#### A. Format Pill Selector
Replaces `<select id="rev-size">` with horizontal quick-tap chips:
- Presets:
  - `Pint` (Icon: Pint)
  - `Half Pint` (Icon: Half glass)
  - `Third Pint` (Icon: Third glass)
  - `Can` (Icon: Can)
  - `Bottle` (Icon: Bottle)
  - `Flight / Sample` (Icon: Test tube / sample)
  - `Other...` (reveals custom text input)
- Visual State:
  - Inactive: Bordered pill `background: var(--bg-card); color: var(--text-secondary); min-height: 40px;`
  - Active: High-contrast `background: var(--primary); color: #ffffff; font-weight: 700;`
  - Touch target: Full 44px height with `display: inline-flex; align-items: center; gap: 6px;`.

#### B. Price Input Ergonomics
- Input attributes:
  ```html
  <div class="price-input-wrapper">
    <span class="currency-prefix">£</span>
    <input
      type="text"
      inputmode="decimal"
      pattern="[0-9]*[.,]?[0-9]*"
      placeholder="0.00"
      aria-label="Price in pounds"
    />
  </div>
  ```
- Quick Price Chips:
  - One-tap common prices for festival tokens or pints: `[ £3.50 ] [ £4.50 ] [ £5.50 ] [ £6.50 ]`.

---

### 3.4 Categorized Flavor Tag Selector: `TastingTagPicker.tsx`

#### A. Category Grouping
Instead of dumping 16+ tags in an unwieldy block, organize into 3 sensory tabs or clusters:
1. **Hops & Fruit:** `Hoppy`, `Citrus`, `Tropical`, `Piney`, `Fruity`
2. **Malt & Dark:** `Malty`, `Roasty`, `Chocolate`, `Coffee`, `Caramel`, `Smoky`
3. **Yeast & Finish:** `Crisp`, `Hazy`, `Sour`, `Bitter`, `Sweet`

#### B. Mobile UI Layout
- Category filter bar: Mini pill tabs allowing the user to view only the relevant sensory profile or `All`.
- Tag Chips:
  - 40px height with clear selected checkmark (`<Check size={14} />`).
  - Active tags appear with glowing border and primary background tint.
  - Selected counter: `Tags (3/8)`.
- Quick-Add Custom Tag:
  - Integrated into the tag flow: An input field with instant `+ Add` button.
  - Sanitized automatically via existing `src/utils/tastingTags.ts` (`normalizeTag`, length cap 24).

---

### 3.5 Quick Tasting Notes & Impressions: `TastingNotesInput.tsx`

#### A. Making Notes Painless
- **Relax Requirement:** Make text notes optional if a rating and at least one tag or format are selected.
- **Quick Impression Chips (1-Tap Notes):**
  - Provide quick one-tap tasting note impressions:
    - `"Juicy & tropical"`
    - `"Crisp, clean finish"`
    - `"Heavy roasty bitterness"`
    - `"Smooth creamy mouthfeel"`
    - `"Pleasant tart acidity"`
    - `"Noticeable alcohol warmth"`
  - Tapping a chip automatically appends it into the notes textarea with proper punctuation.
- **Auto-Expanding Textarea:**
  - Modern CSS `field-sizing: content;` with fallback JavaScript `scrollHeight` adjustment.
  - Starts compact (2 lines, ~56px) and gently expands as the user types, preserving screen estate.

---

### 3.6 Mobile Camera & Photo Attachment: `ReviewPhotoControl.tsx`

#### A. High-Affordance Camera Action
- Direct camera trigger button: Large 48px action button with Camera icon:
  ```html
  <label for="review-photo-capture" class="btn-camera-capture">
    <Camera size={20} />
    <span>Take Photo of Drink</span>
    <input
      type="file"
      id="review-photo-capture"
      accept="image/*"
      capture="environment"
      class="visually-hidden"
    />
  </label>
  ```
- Instant WebP compression using existing `src/utils/imageUtils.ts`:
  - Canvas resizing to max 800px dimension @ 0.75 WebP quality.
  - Non-blocking asynchronous processing with animated spinner indicator.
- Instant Preview & Quick Retake:
  - Renders square thumbnail (80×80px) with overlay delete/retake icon.

---

### 3.7 Drink Card Trigger Optimization: `BeerDrinkCard.tsx`

#### A. Card Call-to-Action Hierarchy
On mobile viewports (`<= 600px`):
- Currently, the card rating dash mixes average rating, review button, reviews toggle, wishlist bookmark, and share icon in a crowded horizontal flex row.
- **Enhanced Mobile Action Layout:**
  - Primary Action Button: Full-width or prominent pill `[ ⭐ Rate & Review ]` (44px height, high-contrast amber/gold border, elevated z-index).
  - If the user has already reviewed the beer (identified via `review.userId === user.uid`), update the button state to:
    `[ ⭐ You rated: 8.5/10 • Edit ]`
  - Secondary actions (Wishlist bookmark, Share, Reviews count drawer) grouped cleanly in an unobtrusive icon toolbar.

---

## 4. Technical Architecture & Component Decomposition

Adhering to Keg Swap's `component-refactoring` skill and React 19 standards:

```text
src/
├── components/
│   ├── review/
│   │   ├── ReviewBottomSheet.tsx       # Root dialog container, gestures, keyboard management
│   │   ├── RatingScrubber.tsx          # 0.5-10.0 mobile slider, score badge & sentiment labels
│   │   ├── ServingFormatSelector.tsx   # Format pills (Pint, Can, etc.) and currency price input
│   │   ├── TastingTagPicker.tsx        # Categorized flavor tags with quick-add
│   │   ├── TastingNotesInput.tsx       # Auto-growing textarea + 1-tap impression chips
│   │   └── ReviewPhotoControl.tsx      # Camera capture with canvas WebP compression
│   ├── EventDetailScreen.tsx           # Refactored: imports ReviewBottomSheet (removes 280 lines)
│   ├── StarRating.tsx                  # Kept lightweight for static card/profile rating displays
│   └── BeerDrinkCard.tsx               # Updated mobile CTA for reviews
├── hooks/
│   └── useReviewDraft.ts               # Custom hook for review form state, validation & local draft
└── types.ts                            # Domain models (BeerReview, BeerReviewDoc)
```

### 4.1 Custom Hook: `useReviewDraft.ts`
Encapsulates all review form state and persistence:
```typescript
export interface UseReviewDraftOptions {
  drink: BeerDrink | null;
  eventId: string;
  user: User;
  onSuccess: () => void;
}

export function useReviewDraft({ drink, eventId, user, onSuccess }: UseReviewDraftOptions) {
  // 1. Manages rating (0.5 to 10.0, default 7.0)
  // 2. Manages serving size, price, tags, notes, photo
  // 3. Persists in-progress draft to sessionStorage in case modal is accidentally dismissed
  // 4. Submits review document to Firestore subcollection:
  //    events/{eventId}/drinks/{drink.id}/reviews/{reviewId}
  // 5. Handles image upload to Firebase Storage or WebP data URL
  // 6. Cleans tags via cleanTags() from src/utils/tastingTags.ts
}
```

---

## 5. Modern Web Standards & Platform Integration

### 5.1 Web APIs & Modern CSS
1. **Dynamic Viewport Units (`dvh`):**
   - Use `max-height: 90dvh` to ensure the modal never overflows when mobile browser chrome expands or contracts.
2. **Dialog `closedby="any"` & Light Dismiss:**
   - Supported natively in Chrome 134+, Firefox 141+.
   - Includes graceful fallback: backdrop click event listener for Safari / iOS.
3. **Touch Action Optimization:**
   - `touch-action: pan-y` on bottom sheet scroll container.
   - `touch-action: none` on the rating scrubber track to prevent vertical page scrolling during horizontal dragging.
4. **Haptic Feedback (Web Vibration API):**
   - Progressive enhancement:
     ```typescript
     export function triggerHapticTick(pattern: number = 8) {
       if (typeof window !== 'undefined' && 'vibrate' in navigator) {
         try {
           navigator.vibrate(pattern);
         } catch {
           // Silently ignore in unsupported or battery-restricted environments
         }
       }
     }
     ```
5. **Autofill & Input Modes:**
   - `inputmode="decimal"` on price input.
   - `enterkeyhint="done"` on custom tag input.
   - Zero-zoom iOS rule: `font-size: 16px` minimum on all `<input>` and `<textarea>` elements prevents iOS Safari from automatically zooming the page.

---

## 6. Theme Tokens & Design Compliance

In accordance with `AGENTS.md`, zero hardcoded hex colors will be used. All elements strictly bind to Keg Swap's CSS Custom Properties:

| UI Element | CSS Token (Light Theme) | CSS Token (Dark Theme) |
| :--- | :--- | :--- |
| **Sheet Background** | `var(--bg-card)` (#ffffff) | `var(--bg-card)` (#1c1917) |
| **Sheet Backdrop** | `rgba(0, 0, 0, 0.6)` + blur | `rgba(0, 0, 0, 0.75)` + blur |
| **Rating Track (Empty)** | `var(--border-color)` | `var(--border-color)` |
| **Rating Track (Filled)**| `var(--primary)` (#ca8a04) | `var(--primary)` (#f59e0b) |
| **Rating Score Badge** | `rgba(202, 138, 4, 0.12)` + amber border | `rgba(245, 158, 11, 0.15)` + amber border |
| **Active Tag Chip** | `var(--primary)` text + border | `var(--primary)` text + border |
| **Drag Handle** | `var(--text-muted)` (40% opacity) | `var(--text-muted)` (40% opacity) |
| **Action CTA Button** | `var(--primary)` -> `var(--primary-hover)` | `var(--primary)` -> `var(--primary-hover)` |

---

## 7. Failure Handling & Offline Resilience

1. **Spotty Taproom Connectivity:**
   - Firestore's offline persistent cache (`persistentLocalCache`) automatically queues the review write locally.
   - UI displays immediate optimistic success and toasts: *"Review saved! Syncing once connected."*
2. **Accidental Dismissal Recovery:**
   - If a user accidentally swipes down or taps outside while writing notes, the form state is retained in `sessionStorage[draft_${drinkId}]` for 30 minutes. Reopening the review modal restores their draft with an alert: *"Restored draft"*.
3. **Photo Upload Failures:**
   - If image compression or upload fails due to network drop, the user is given the option to *"Submit Review Without Photo"* so their rating and notes are not lost.

---

## 8. Testing & Verification Runbook

In accordance with `keg-quality-testing`:
1. **Unit Tests (Vitest):**
   - `RatingScrubber.test.tsx`:
     - Test 0.5 step boundaries (minimum 0.5, maximum 10.0).
     - Test keyboard navigation (`ArrowRight` adds 0.5, `ArrowLeft` subtracts 0.5).
     - Test touch event calculation and snapping math.
   - `ServingFormatSelector.test.tsx`:
     - Verify format selection updates state.
     - Verify custom format reveals text input.
   - `TastingTagPicker.test.tsx`:
     - Verify tag cap at 8 tags.
     - Verify normalization via `cleanTags`.
2. **Accessibility Audits:**
   - Run `npx axe-cli` / Chrome DevTools MCP on mobile viewport (375×667).
   - Verify touch targets ≥ 44×44px for all buttons, chips, and scrubber handles.
   - Verify screen reader announcements for rating value changes.
3. **Cross-Device Physical Checks:**
   - iOS Safari (iPhone SE 375px, iPhone 14/15 390px, iPhone 15 Pro Max 430px).
   - Android Chrome (Pixel 7/8, Samsung Galaxy).
   - Test virtual keyboard behavior (ensure input is visible during typing).

---

## 9. Implementation Roadmap & Phases

- **Phase 1: Component Extraction & Scaffolding**
  - Create `src/components/review/` directory.
  - Implement `RatingScrubber.tsx` and verify 0.5–10.0 snapping math.
  - Create `useReviewDraft.ts` hook.
- **Phase 2: Sub-Component Implementation**
  - Implement `ServingFormatSelector.tsx` (pills + price input).
  - Implement `TastingTagPicker.tsx` (categorized tabs + custom tag).
  - Implement `TastingNotesInput.tsx` (auto-resize textarea + quick impressions).
  - Implement `ReviewPhotoControl.tsx` (camera trigger + WebP preview).
- **Phase 3: Bottom Sheet & Gesture Integration**
  - Implement `ReviewBottomSheet.tsx` with drag-handle swipe gestures and safe-area insets.
  - Replace legacy review dialog in `EventDetailScreen.tsx`.
- **Phase 4: Styling, Theming & Polish**
  - Add CSS animations and token bindings in `src/App.css`.
  - Add haptic feedback and draft recovery.
  - Verify `npm run lint` and `npm run build`.
