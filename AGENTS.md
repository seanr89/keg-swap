# Keg Swap 🍺 — Agent & Engineering Guidelines (`AGENTS.md`)

Welcome to the **Keg Swap** repository. This document defines the engineering standards, architecture rules, subagent specializations, and workspace skills for all AI agents and developers working on this codebase.

---

## 1. Repository Architecture & Stack

- **Framework:** React 19 (`react`, `react-dom`)
- **Build Tool:** Vite 8 (`vite`, `@vitejs/plugin-react`)
- **Language:** TypeScript 6 (`strict: true`, modern module resolution)
- **Backend Services:** Firebase v12 (Firebase Authentication, Cloud Firestore)
- **Styling:** Vanilla CSS Custom Properties / Tokens (`src/index.css`, `src/App.css`)
- **Icons:** Lucide React (`lucide-react`)
- **Linter:** Oxlint (`npm run lint`)
- **Hosting / CI:** Azure Static Web Apps via GitHub Actions (`.github/workflows/build.yml`)

### Directory Layout
```text
keg-swap/
├── .agents/
│   └── skills/
│       ├── firebase-data-architecture/   # Firebase schemas, 1MB limits, security rules
│       ├── component-refactoring/         # React 19 decomposition & bundle splitting
│       ├── beer-catalog-manager/          # Dataset integrity, ABV math, batch import
│       └── keg-quality-testing/           # Test runbook, Vitest, and verification
├── public/                                # Static assets (favicon, icons)
├── src/
│   ├── assets/                            # Brand images & screenshots
│   ├── components/                        # React UI components
│   │   ├── AdminScreen.tsx                # Location CRUD management
│   │   ├── AuthScreen.tsx                 # Email/Password authentication
│   │   ├── CookieConsent.tsx              # GDPR/Privacy cookie banner
│   │   ├── EventCard.tsx                  # Event card with touch swipe gesture
│   │   ├── EventDetailScreen.tsx          # Beer lists, batch upload, reviews
│   │   ├── EventModal.tsx                 # Event creation dialog
│   │   ├── PrivacyPolicyModal.tsx         # Privacy policy dialog
│   │   ├── StarRating.tsx                 # 10-point beer glass rating widget
│   │   ├── StatsHeader.tsx                # Event count metrics dashboard
│   │   ├── UserProfileScreen.tsx          # Profile & review history
│   │   └── UserSearchModal.tsx            # Friend discovery modal
│   ├── utils/
│   │   └── imageUtils.ts                  # Canvas compression & validation
│   ├── App.tsx                            # Root application controller
│   ├── firebase.ts                        # Firebase SDK initialization
│   ├── types.ts                           # TypeScript domain models
│   ├── index.css                          # Design tokens (light & dark palettes)
│   └── main.tsx                           # Entry point
├── beers.json                             # Seed and batch beer dataset
└── package.json                           # Dependencies & scripts
```

---

## 2. Specialized Subagents

When executing tasks on this codebase, delegate or specialize according to these roles:

| Subagent | Role | Focus Areas |
| :--- | :--- | :--- |
| **`firebase-specialist`** | Cloud Backend Architect | Firestore schema design, Firestore security rules, subcollections, eliminating 1MB document limit risk, Firebase Storage migrations, index configuration. |
| **`frontend-refactorer`** | React 19 & UI Engineer | Component decomposition (`App.tsx`, `EventDetailScreen.tsx`), custom hooks (`useAuth`, `useEvents`), code splitting (`React.lazy`), CSS token management. |
| **`qa-auditor`** | Quality & Security Analyst | Unit testing, verification gates (`oxlint`, `build`), accessibility auditing, edge-case analysis, security leak prevention. |

---

## 3. Workspace Skills

The following skills are available in `.agents/skills/`:

1. **`firebase-data-architecture`** (`.agents/skills/firebase-data-architecture/SKILL.md`):
   Procedures for handling Firestore document limits, securing data access, and replacing client-only security checks with robust Firestore security rules.
2. **`component-refactoring`** (`.agents/skills/component-refactoring/SKILL.md`):
   Workflows for decomposing large monolithic screens into modular components, extracting stateful hooks, and lazy loading heavy components.
3. **`beer-catalog-manager`** (`.agents/skills/beer-catalog-manager/SKILL.md`):
   Rules for parsing ABV strings, rating calculations (0.5 to 10 scale), and batch JSON ingestion.
4. **`keg-quality-testing`** (`.agents/skills/keg-quality-testing/SKILL.md`):
   Testing patterns, test environment configuration (Vitest), and CI quality gate steps.

---

## 4. Engineering Standards & Guardrails

### A. TypeScript & Linting
- Always run `npm run lint` and `npm run build` after making code changes.
- Never disable TypeScript strict checks or use `any` unless interacting with untyped 3rd party modules.
- Ensure all models are centralized in `src/types.ts`.

### B. Styling & Theming
- Keg Swap supports both a **Light Theme** (default craft barley) and a **Dark Theme** (charcoal stout).
- Never use hardcoded hex colors inside component styles. Always use CSS custom properties (`var(--primary)`, `var(--bg-card)`, `var(--text-primary)`, etc.).
- Maintain zero-FOUC (Flash of Unstyled Content) by respecting the inline theme loader in `index.html`.

### C. Security & Data Privacy
- **Do not hardcode admin credentials:** Migrate hardcoded admin checks (`srafferty89@gmail.com`) to Firebase Auth Custom Claims or Firestore role documents.
- **Never perform destructive actions silently:** Always show a confirmation dialog before deleting events, locations, or drinks.
- **Privacy enforcement:** Do not download all user accounts to the client. Restrict Firestore queries to `where('isPublic', '==', true)`.
- **Image handling:** Do not store multi-megabyte base64 strings directly in Firestore documents.
