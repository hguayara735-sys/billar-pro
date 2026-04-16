# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (http://localhost:5173)
npm run build     # Production build
npm run preview   # Preview production build
npm run lint      # ESLint
```

## Stack

- **React 19** + **Vite** — no React Router yet; routing to be added as needed
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin — use `@import "tailwindcss"` in CSS, no `tailwind.config.js` required
- **Zustand** — global state management
- **date-fns** — date/time formatting and calculations
- **lucide-react** — icon library

## Folder structure (`src/`)

```
features/
  scoring/   # Game scoring logic and UI
  tables/    # Pool table management (availability, timer, assignment)
  cash/      # Cash register, payments, shift totals
  admin/     # Admin panel (rates, users, reports)
components/
  ui/        # Reusable presentational components (Button, Card, Modal, etc.)
hooks/       # Custom React hooks
lib/         # Pure utilities, formatters, constants
pages/       # Top-level page components (one per route)
store/       # Zustand store slices
```

## Current state

All feature folders and `store/`, `hooks/`, `lib/`, `pages/` are empty scaffolding (`.gitkeep` only). `src/App.jsx` and `src/main.jsx` are the only source files with content so far.

## Conventions

- One Zustand slice per domain, exported from `store/` and composed in a single `useStore` or split hooks.
- Feature folders own their own components, hooks, and local state; only shared things go in `components/ui` or `hooks`.
- `lib/` is framework-free — no React imports.
