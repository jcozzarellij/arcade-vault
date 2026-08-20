# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault — a platform for playing games online and competing for the highest score. `README.md` and every spec are written in Spanish; UI copy is Spanish too.

Shipped through specs 01–09 (`specs/`): the MVP screens (`/`, `/about`, `/games`, `/game/[id]`, `/game/[id]/play`, `/hall-of-fame`, `/login`), a contact endpoint backed by Resend (`app/api/contact/route.ts`), Supabase SSR integration, and **four playable games** — `asteroids`, `tetris`, `arkanoid`, `snake`. Catalog and leaderboards are real Supabase tables (`games`, `scores`), not static data.

`/login` is not real auth: `lib/session.ts` keeps `{ name }` in `localStorage` (`av_user`) and exposes it through `useStoredUser()` (`useSyncExternalStore`). Supabase session sync exists (`proxy.ts` → `utils/supabase/proxy.ts`) but no sign-in flow uses it yet.

No test runner is configured.

## Commands

- `npm run dev` — dev server (Turbopack by default in Next.js 16)
- `npm run build` / `npm run start` — production build / serve
- `npm run lint` — ESLint flat config (`eslint.config.mjs`)

## Game architecture

Read `.claude/skills/spec-game/references/integration-contract.md` before touching or adding any game — it is the authoritative, up-to-date contract. Summary:

- `lib/games/<slug>/engine.ts` — framework-agnostic TypeScript, zero React/DOM (no `window`, `document`, `requestAnimationFrame`). Exports `WORLD_W`/`WORLD_H`, `<Name>Input`, `<Name>State`, and a `<Name>Engine` class with `reset()`, `update(dt, input)`, `draw(ctx)`, `getState()`. Image assets are the one sanctioned extension: `setSprites(image)`, with the canvas component owning the `new Image()` lifecycle (precedent: `lib/games/snake/engine.ts`).
- `components/games/<Name>Canvas.tsx` — owns the RAF loop, keyboard listeners, DPR/`ResizeObserver` scaling. Fixed props: `{ paused, onStateChange, onGameOver, restartSignal }`.
- `components/games/registry.ts` — `GAME_REGISTRY[gameId] → { Canvas, hasLives, extraStat? }`. Registering here is what makes a game playable; `GamePlayerClient` and the `/game/[id]` routes iterate generically and need no per-game edits.
- Data access: `lib/data.ts` (server — `getGames`, `getGameById`, `getTopScores`, `getBestScore`), `lib/data-client.ts` (`getPlayerBest`), `lib/session.ts` (`saveScore`, returns a result object and never throws). There is no static `GAMES` array — a new game's catalog entry is a Supabase migration/INSERT, not a `lib/data.ts` edit.
- `references/implemented-games.md` — snapshot of the `games` table (id, title, short description, category, color), playable entries first. It's a point-in-time copy, so query Supabase if you need current data.

## Spec Driven Design workflow

- Specs live in `specs/NN-slug.md` (Spanish, with a `Status` / `Depends on` / `Date` / `Objective` header block). Specs precede implementation here.
- `/spec` and `/spec-impl` come from https://github.com/Klerith/fernando-skills, vendored into `.claude/skills/` and pinned by `skills-lock.json` (reinstall with `npx skills@latest add Klerith/fernando-skills`).
- **`/spec-game`** — project-local skill (`.claude/skills/spec-game/`) that specializes `/spec` for adding a playable game. Use it instead of plain `/spec` for any new game.
- `specs/.spec-config.yml` sets `AutoCreateBranch: true`, so `/spec-impl` creates and checks out `spec-NN-slug` without asking.
- `references/` holds inputs, not shipped code: `started_games/` (vanilla-JS originals being ported), `templates/` (the JSX/HTML prototype the screens were ported from), `source_assets/` (spritesheets).
- Always use `/frontend-design` when building or reshaping user interfaces.
- Supabase work: the `supabase` and `supabase-postgres-best-practices` skills are installed, and `.mcp.json` configures the Supabase MCP server (schema changes via `apply_migration`).

## Tooling gotchas

- A `PostToolUse` hook (`.claude/hooks/format-and-lint.mjs`, wired in `.claude/settings.json`) runs Prettier then `eslint --fix` on every file written or edited, so the file on disk may differ from what you wrote. Don't hand-format. It never fails the tool call; it only reports unresolved ESLint errors back into context. It skips `references/`, `node_modules`, `.next`, `out`, `build`.
- `.claude/settings.json` is shared; `.claude/settings.local.json` is gitignored/personal.
- Env vars go in `.env.local` (gitignored) — see `.env.template`: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CONTACT_TO_EMAIL`, `SUPABASE_DB_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Stack notes

- Next.js **16.2**, React **19.2**, TypeScript (strict mode), Tailwind CSS **v4** via `@tailwindcss/postcss` (no `tailwind.config` file — v4 is CSS-first, configured in `app/globals.css`).
- App Router only (`app/`), no `pages/` directory.
- Path alias `@/*` maps to the project root (`tsconfig.json`).
- Supabase clients: `utils/supabase/{client,server,proxy}.ts` — both `client` and `server` export `createClient` (the server one is `async` and wraps `cookies()`).

## This is Next.js 16, not the Next.js in your training data

Per `AGENTS.md`, read the matching doc under `node_modules/next/dist/docs/` before implementing any Next.js-specific feature — training data reflects older Next.js and will suggest removed or renamed APIs. Two changes in this version are easy to get wrong silently:

- **Middleware was renamed to Proxy.** A root-level `middleware.ts` no longer exists as a concept — this repo uses `proxy.ts` (`export async function proxy(request)`), see `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.
- **Caching is opt-in via Cache Components**, not automatic full-route caching. `next.config.ts` does not set `cacheComponents: true`, so the app is on the default (previous) caching model. If you enable `cacheComponents`, components doing uncached dynamic work (reading `cookies()`, `headers()`, random/time values, etc.) must be wrapped in `<Suspense>` or marked `'use cache'`, or they'll error — see `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`.
