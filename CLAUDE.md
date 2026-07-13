# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

VigApp is a client / lead / marketing management SPA (CRM) for tech startups. UI language is **Brazilian Portuguese (pt-BR)**. The stack is deliberately minimal: **vanilla JavaScript + Vite + Firebase** — no framework, no TypeScript, no test suite.

## Commands

```bash
npm run dev      # Vite dev server on http://localhost:3000 (auto-opens browser)
npm run build    # Production build to dist/
npm run preview  # Serve the production build locally
```

There is no lint, format, or test tooling configured.

## Environment setup

Firebase and Google Maps keys are read from Vite env vars. Copy `.env.example` to `.env` and fill in the values (all prefixed `VITE_`, so they are exposed to the client bundle). Without a valid Firebase config the app will fail at auth. `src/firebase.js` is the single place that reads `import.meta.env`.

## Architecture

Everything is client-side. There is no backend of our own — Firebase Auth + Firestore are the entire backend.

**Bootstrap flow (`src/main.js`):**
1. Apply saved theme (before render, to avoid a flash).
2. `initAuth()` attaches the Firebase auth listener; `waitForAuth()` resolves once the initial auth state is known.
3. If no user → render the login page. On successful login the app does a **full `window.location.reload()`** to bootstrap the authenticated shell (it does not transition in-place).
4. If a user exists → `renderApp()` builds the sidebar + header + `#page-container` shell, then registers routes and starts the router.

**Routing (`src/router.js`):** Hand-rolled history-API SPA router. `registerRoute(path, handler)` maps a path to an async render function; `navigate(path)` clears `#page-container`, calls the handler with the container, and stores the handler's return value as a **cleanup function** (called on the next navigation — use this to tear down listeners/intervals). Page titles live in the `routeTitles` map inside the router. All routes are registered in `main.js`.

**Pages (`src/pages/*.js`):** Each page exports one `render<Name>Page(container)` function that (1) sets `container.innerHTML` to a template string, (2) wires event listeners, and (3) loads data from Firestore. Pages hold their data in **module-level `let` variables** (e.g. `let clients = []`) — this is the established state pattern; there is no store. Follow it rather than introducing new state management.

**Auth (`src/auth.js`):** Wraps Firebase Auth. On sign-in it fetches the user's Firestore doc from the `users` collection to get `role` (`'admin'` | `'user'`), falling back to a synthesized user object if the doc is missing. `isAdmin()` gates admin-only nav/features. Email/password and Google (`signInWithPopup`) are both supported; both ensure a `users/{uid}` doc exists.

**Firebase module split (for bundle size):** `src/firebase.js` initializes the app and **only** the Auth SDK (statically imported) — this is all the login screen needs. The **Firestore SDK is loaded lazily** via `src/firestore-sdk.js`, whose `getFirestoreSDK()` does a memoized `import('firebase/firestore')` and returns `{ db, ...allFirestoreFns }`. This keeps Firestore (~567 kB) out of the initial bundle; it downloads only after a user is authenticated. Never statically import `firebase/firestore` or add Firestore exports back to `firebase.js` — that would pull it into the login bundle again. Code that needs Firestore calls `await getFirestoreSDK()` and destructures what it needs.

**Firestore access (`src/utils/firestore.js`):** All data access goes through these generic async helpers — `createDocument`, `updateDocument`, `deleteDocument`, `getDocuments(name, filters, sortBy, limitCount)`, `getDocument` — each of which `await getFirestoreSDK()` internally. Do **not** call the raw `firebase/firestore` SDK from pages; use these wrappers. `createDocument`/`updateDocument` automatically stamp audit fields (`createdBy`/`updatedBy` as `{uid, name, email}` and `serverTimestamp()`).

**Firestore collections:** `users`, `leads`, `companies`, `clients`, `services`, `deals` (kanban pipeline), `subscriptions`, `payments`, `events` (calendar), `marketing_campaigns`.

## UI conventions

- **No framework — render with template strings + DOM APIs.** Pages build HTML as strings and attach listeners via `querySelector`/`addEventListener` after injecting. Match this style.
- **Icons:** Use `icon(name, attrs)` from `src/icons.js`, which returns Lucide SVG markup as a string. Reference icons through the `ICONS` map (semantic keys → Lucide names) rather than hardcoding names.
- **Modals:** `openModal({title, content, size, actions})` and `confirmDialog({...})` from `src/components/modal.js`. Action buttons receive a `close` callback. Forms are built as HTML strings inside the modal content and read back via `getElementById` in the action handler.
- **Toasts:** `showToast(message, type)` where type is `success|error|warning|info`.
- **Formatting:** Locale-aware helpers in `src/utils/format.js` (`formatCurrency` → BRL, `formatPhone`, `formatCNPJ`, `timeAgo`, etc.) and Firestore timestamp formatters in `src/utils/firestore.js`. Always format currency/dates for pt-BR.
- **Theming:** Dark/light via `data-theme` on `<html>`, persisted to `localStorage` under `vigapp-theme`. All colors are CSS custom properties defined for both themes in `src/styles/index.css` — use the `--var` tokens (`--bg-*`, `--text-*`, `--accent`, `--success`, etc.), never hardcoded colors. The design system is intentionally minimalist black & white.

## Styling

Four global stylesheets, imported once in `main.js` in this order: `index.css` (reset + design tokens), `components.css`, `layout.css`, `pages.css`. There is no CSS-in-JS or scoping — class names are global, so reuse existing classes (`.btn`, `.btn-primary`, `.table`, `.form-input`, `.page-header`, `.empty-state`, `.avatar`, etc.) seen across pages.

## Static assets

Live in `public/` (Vite serves it at the root). E.g. the logo is referenced as `/midia/logo vigapp.png`.
