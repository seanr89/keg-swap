# Keg Swap 🍺

![Build Status](https://github.com/seanr89/keg-swap/actions/workflows/build.yml/badge.svg)

**Keg Swap** is a premium, high-fidelity web application designed to track, discover, and swap details about local beer & ale events. Whether it's an Imperial Stout & Oyster Night, a Homebrew Exchange, or a Craft IPA Tap Takeover, Keg Swap keeps beer enthusiasts connected with a fluid, modern board interface.

---

## 🎨 Design & Theme

Keg Swap features a rich, responsive, and tactile interface styled with **Vanilla CSS Variables**.

- **Default Light Theme:** A warm, premium theme inspired by light craft beers, ales, and barley cream tones (`#f7f5f0` background, `#ca8a04` amber gold accent).
- **Dark Theme Option:** A deep charcoal-stout dark theme (`#0c0a09` background, `#f59e0b` golden amber accent) optimized for low-light environments.
- **Theme Persistence:** Theme preferences are stored in `localStorage` under `keg_swap_theme` and initialized immediately on page load via inline blocking script to prevent Flash of Unstyled Content (FOUC).
- **Responsive Layout:** Tailored with fluid card grids, desktop header action toolbars, and a mobile-first sticky Floating Action Button (FAB).
- **Micro-Animations:** Fluid floating card states, drag-and-swipe gestures, and scale transitions.

---

## 🛠️ Technology Stack

- **Core & Build:** [React 19](https://react.dev/), [Vite 8](https://vite.dev/), [TypeScript 6](https://www.typescriptlang.org/)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Styling:** Custom Vanilla CSS with CSS Custom Properties, layout utilities, and modern selectors (e.g. native backdrop filters and grid auto-fill)
- **Linter:** [Oxlint](https://github.com/oxc-project/oxc) for lightning-fast linting checks

---

## 📂 Project Structure

```bash
keg-swap/
├── index.html              # Entry HTML template (includes FOUC-prevention theme script)
├── package.json            # Scripts, dependency mappings, and engine metadata
├── tsconfig.json           # Global TypeScript configuration compiler options
├── vite.config.ts          # Vite build pipeline and plugin declarations
├── src/
│   ├── main.tsx            # Application entry mount point (strict-mode rendering)
│   ├── App.tsx             # Main controller, holds filter state, event list, and theme toggling
│   ├── App.css             # Layout-specific stylesheet (components, sections, headers)
│   ├── index.css           # Global design tokens (fonts, margins, color palettes, scrollbars)
│   ├── types.ts            # Core TypeScript model interfaces (BeerEvent, BeerDrink, BeerReview)
│   ├── components/
│   │   ├── StatsHeader.tsx # Header dashboard showing total, upcoming, active, and completed metrics
│   │   ├── EventCard.tsx   # Individual event card with swipe-to-delete gesture & status changer
│   │   ├── EventModal.tsx  # Native HTML5 dialog modal with form validation for creating events
│   │   └── EventDetailScreen.tsx # Dedicated event detail view displaying beers, add beer form, and rating review sheets
│   └── assets/             # Brand logos, static icons, and media files
```

---

## 📋 Data Schemas & Structures

### 1. Drink Schema
Available drinks are modeled inside events following this exact structure:
```json
{
  "id": "d1-1",
  "name": "Amethyst",
  "brewery": "Amity Brew Co",
  "location": "Leeds",
  "abv": "4.6%",
  "style": "Porter",
  "description": "Dark, plums, berries, full-bodied",
  "reviews": []
}
```

### 2. Review Schema
Each review submitted by users follows this schema:
```json
{
  "id": "r1",
  "reviewer": "Sarah M.",
  "rating": 5,
  "comment": "Incredibly smooth porter. The plum notes really shine through without being overly sweet.",
  "createdAt": "2026-07-12T16:00:00.000Z"
}
```

---

## ✨ Features & Functionality

### 1. Event Analytics Dashboard
The top section features a summary dashboard displaying key metrics:
- **Total Events** registered.
- **Upcoming** events planned.
- **Active Now** events currently ongoing.
- **Completed** events history.

### 2. Search & Status Filtering
- **Keyword Search:** Real-time search matching event name and venue location address.
- **Status Filter Tabs:** Filter events instantly by status segment: *All*, *Upcoming*, *Ongoing*, *Completed*, or *Cancelled*.

### 3. Native `<dialog>` Modal Creation Form
- Utilizes the modern native HTML5 `<dialog>` API.
- Implements declarative light-dismiss (`closedby="any"`) to close the modal when clicking outside, with JavaScript event fallbacks for Safari.
- Custom styled backdrop blur (`rgba(12, 10, 9, 0.7)` with `blur(8px)`).
- Full form validation for fields (Event Name, Date, Location, and Status).

### 4. Interactive Event Cards
- **Click to Inspect Details:** Clicking on an event card/widget transitions the interface smoothly to the Event Detail view.
- **Status Selector:** Dropdown selector to update the event's status dynamically (e.g., transition from *Upcoming* to *Ongoing*).
- **Status Badges:** Color-coded status badges with icons to represent current progress.
- **Desktop Delete:** Single-click trash icon to instantly remove cards.
- **Mobile Swipe-to-Delete:** Touch-enabled gesture swiping left to reveal the red delete drawer (designed for mobile touch precision).

### 5. Detailed Event screen & Drinks List
- **Detailed Event Metadata:** Shows status, date, and venue details.
- **Available Beer/Drink List:** Renders all registered drinks in a premium styled list matching the specific format.
- **Interactive Review & Star Rating System:**
  - Displays average star ratings (`★ ★ ★ ★ ☆`) computed dynamically from user reviews.
  - Expandable reviews drawers showing reviewer names, star ratings, date, and comments.
  - Inline **Write a Review** form with interactive star buttons (1-5 stars selector) and feedback validator.
- **Add Beer / Drink Form:** Collapse/expand form container allowing organizers to add new drinks on the fly (Name, Brewery, Location, ABV, Style, Description).

### 6. LocalStorage Data Synchronization
- Events, custom beers, and custom reviews are persisted automatically under the local storage key `keg_swap_events` so they survive page reloads and browser sessions.

---

## 🚀 Getting Started

### Prerequisites

Make sure you have Node.js installed on your local development machine.

### Installation

Clone the repository and install all node packages:

```bash
npm install
```

### Development Server

Spin up the local hot-reloading development server:

```bash
npm run dev
```

The application will default to running on `http://localhost:5173/`.

### Building for Production

Compile TypeScript and bundle code for deployment:

```bash
npm run build
```

The production-ready assets will be created in the `dist/` directory.

### Linting Checks

Run the fast linter to check for syntax and style issues:

```bash
npm run lint
```

---

## 🔥 Firebase Integration & Setup

Keg Swap supports **Firebase Authentication** for user accounts and **Cloud Firestore** for real-time data storage. Follow the steps below to connect your own Firebase project.

### Step 1: Create a Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add Project** and follow the prompts to create a new project.

### Step 2: Enable Email/Password Authentication
1. In the Firebase Console left menu, navigate to **Build > Authentication**.
2. Click **Get Started**.
3. Under the **Sign-in method** tab, click **Email/Password**.
4. Enable the provider and click **Save**.

### Step 3: Create Cloud Firestore Database
1. Navigate to **Build > Firestore Database** in the left menu.
2. Click **Create Database**.
3. Choose your database location, select **Start in production mode** (or test mode), and click **Create**.

### Step 4: Configure Firestore Security Rules
For authentication-based security, navigate to the **Rules** tab in Firestore and define the rules.

Example Rules (Allows logged-in users to read and write events):
```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /events/{eventId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

### Step 5: Register App & Get Config Keys
1. In the Firebase Console, go to **Project Settings** (cog icon next to Project Overview).
2. Under the **General** tab, scroll down to **Your apps** and click the Web icon (`</>`) to register a web app.
3. Give it a nickname, register it, and copy the `firebaseConfig` object keys.

### Step 6: Define Environment Variables
Create a file named `.env.local` in the root directory of your project and populate it with your Firebase keys:

```ini
# Firebase Client Configuration Keys
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
VITE_FIREBASE_APP_ID=1:your_app_id_here
```

Vite will load these environment variables automatically in development and production build environments.
