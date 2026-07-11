# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault — a platform for playing games online and competing for the highest score (see README.md, written in Spanish).

The project is currently a fresh `create-next-app` scaffold: only the default root `layout.tsx`/`page.tsx` exist under `app/`, no routes, data layer, or auth have been built yet.

The README states the project follows a Spec Driven Design workflow using `/spec` and `/spec-impl` commands from https://github.com/Klerith/fernando-skills, installed via `npx skills@latest add Klerith/fernando-skills`. If those commands aren't available in this session, check whether the skill has been installed (`npx skills@latest add Klerith/fernando-skills`) before starting feature work, since specs are expected to precede implementation here.

No test runner is configured yet.

## Stack notes

- Next.js **16.2**, React **19.2**, TypeScript (strict mode), Tailwind CSS **v4** via `@tailwindcss/postcss` (no `tailwind.config` file — v4 is CSS-first, configured in `app/globals.css`).
- App Router only (`app/`), no `pages/` directory.
- Path alias `@/*` maps to the project root (`tsconfig.json`).

## This is Next.js 16, not the Next.js in your training data

Per `AGENTS.md`, read the matching doc under `node_modules/next/dist/docs/` before implementing any Next.js-specific feature — training data reflects older Next.js and will suggest removed or renamed APIs. Two changes in this version are easy to get wrong silently:

- **Middleware was renamed to Proxy.** A root-level `middleware.ts` no longer exists as a concept — use `proxy.ts` (`export function proxy(request)` or a default export), see `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.
- **Caching is opt-in via Cache Components**, not automatic full-route caching. `next.config.ts` currently does not set `cacheComponents: true`, so the app is on the default (previous) caching model. If you enable `cacheComponents`, components doing uncached dynamic work (reading `cookies()`, `headers()`, random/time values, etc.) must be wrapped in `<Suspense>` or marked `'use cache'`, or they'll error — see `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`.

## Skills
Always use /frontend-design for make user interfaces
