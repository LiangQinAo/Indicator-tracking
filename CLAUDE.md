# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common commands

- `npm install`
- `npm run dev` — starts the single Express server in dev mode with Vite middleware on `http://localhost:3000`.
- `npm run build` — builds the frontend bundle into `dist/`.
- `npm run start` — serves the built app and API from `server.ts`.
- `npm run lint` — TypeScript typecheck only (`tsc --noEmit`).
- `npm run clean` — removes `dist/`.

## Tests

- There is currently no automated test suite and no single-test command in this repository.
- Validate changes with `npm run lint` and `npm run build`.

## High-level architecture

### Single-process app: Express + Vite + SQLite

- `server.ts` is the backend entrypoint and the dev/prod app shell.
- In development, it mounts Vite as middleware; in production, it serves `dist/` plus the same API routes.
- There is no separate frontend dev server or separate API service.
- Persistent data lives in `data.db` in the repo root, using synchronous `node:sqlite` access.
- Uploaded files are stored on disk under `uploads/`.

### Frontend structure

- `src/App.tsx` owns route wiring.
- `src/components/Layout.tsx` is the shared viewport contract: mobile header, bottom navigation, safe-area padding, and the main scroll container all live there.
- Most feature pages are route-level components under `src/components/`.
- `src/store/useAppStore.ts` is the shared client data layer for **records** and **indicators** only. It fetches initial state once, then updates local state after API writes.
- `Reports.tsx` and `Admin.tsx` are intentionally outside `useAppStore`; they fetch directly from their own endpoints.

### Data model and API shape

- `records` rows store `{[indicatorId]: value}` as JSON in `values_json`.
- `indicators` define metadata such as normal ranges, color, visibility, short name, and `sort_order`.
- `report_types` and `report_files` back the report archive.
- `ai_jobs` is a persistent async work queue for uploaded report recognition jobs.
- `app_settings` stores runtime configuration such as the selected AI provider.

## Important cross-file invariants

### Indicator defaults exist in two places

- `src/types.ts` exports `DEFAULT_INDICATORS` for the frontend fallback.
- `server.ts` also contains the database seed data and the `/api/indicators/reset` defaults.
- When changing default indicators or their metadata, keep both copies in sync.

### AI recognition is asynchronous and server-driven

- `src/components/AddRecord.tsx` handles both manual entry and AI import.
- Uploading a file for AI recognition creates an `ai_jobs` row through `/api/ai-jobs`.
- `server.ts` polls pending jobs every 3 seconds and processes up to 2 concurrently.
- The server writes recognition results, merge targets, conflicts, and errors back into `ai_jobs`.
- Saving a successful AI job into `records` happens from the frontend by combining store actions with `/api/ai-jobs/:id/resolve`.

### AI provider selection is persisted

- `/admin` is a hidden but routable page (`src/components/Admin.tsx`).
- It updates `app_settings.ai_provider` through `/api/admin/ai-provider`.
- `server.ts` reads that setting to choose between Gemini and Codex for AI jobs.
- Retry limits and timeouts are enforced server-side (`AI_MAX_ATTEMPTS`, `AI_TIMEOUT_MS`).

### Report archive is separate from medical records

- `src/components/Reports.tsx` manages report types and uploaded files directly through `/api/report-types` and `/api/report-files`.
- Report files are stored locally under `uploads/reports` and streamed back through `/api/report-files/:id`.
- Deleting a report must also delete its stored file from disk.
- Deleting a report type returns `409` if any files still reference it.
- UI behavior should preserve grouped listing by report type and direct preview from the file tile.

### Filename handling matters

- For both report uploads and AI job uploads, `server.ts` decodes `file.originalname` from `latin1` to `utf8` before storing metadata.
- Keep that behavior when touching upload flows, otherwise Chinese filenames will become garbled.

### Frontend-visible versioning

- `vite.config.ts` reads the app version from `package.json` and injects it as `__APP_VERSION__`.
- The dashboard displays that version.
- If you make a user-visible frontend change, bump the version in both `package.json` and `package-lock.json`.

## Environment and runtime notes

- The backend reads env vars from `process.env` in `server.ts`.
- Relevant server-side env vars are:
  - `PORT`
  - `GEMINI_API_KEY`
  - `CODEX_API_KEY`
  - `CODEX_API_BASE_URL`
  - `AI_PROXY_URL`
- `vite.config.ts` also injects `process.env.GEMINI_API_KEY` into frontend code and disables HMR when `DISABLE_HMR=true`.

## Repo-local reference material

- This repo includes area-specific references under `.claude/skills/`.
- Read the relevant reference before changing these areas:
  - reports: `.claude/skills/indicator-tracking-reports/references/reports.md`
  - shared frontend layout: `.claude/skills/indicator-tracking-frontend-ui/references/layout.md`
