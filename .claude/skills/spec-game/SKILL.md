---
name: spec-game
description: Designs the spec for adding a playable game (with real leaderboard) to Arcade Vault. Analyzes a reference game under references/started_games/ or a from-scratch description, asks the game-specific questions the platform contract requires, and writes specs/NN-slug.md. Does not write code.
disable-model-invocation: true
argument-hint: "game name or references/started_games/ folder"
---

# /spec-game — Guided game spec designer

This skill produces a spec for adding **one new playable game with a real Supabase
leaderboard** to Arcade Vault. **You don't write code here.** Your job is to identify
the game's source (a vanilla-JS reference under `references/started_games/`, or a
from-scratch description), analyze what it takes to port/build it against the
platform's established game-integration contract, ask the questions that contract
forces, and build the spec section by section until it is ready to save into `specs/`.

## Philosophy

Arcade Vault already has one real game shipped (`asteroids`, specs 05 and 06). That
shipped work established a concrete, repeatable contract for how a game plugs into the
platform: a framework-agnostic engine, a React canvas wrapper, wiring into the shared
game shell, and a row in Supabase's `games` table. This skill's entire value is knowing
that contract cold and forcing every new game's spec through it — so nobody has to
rediscover it by re-reading `AsteroidesCanvas.tsx` from scratch.

This skill is deliberately **not a standalone spec format** — it is `/spec` specialized
for games. Read `.claude/skills/spec/SKILL.md` in full and treat it as the authoritative
source for _how_ to run a spec-writing session: its phase discipline (context → clarify
→ build section by section → save), its question cadence (blocks of 3-5, not one at a
time), its per-section confirmation rhythm, and its hard rules (never write code, never
auto-approve, never generate the whole spec in one shot) all apply here unchanged. Read
`.claude/skills/spec/template.md` for the document shape itself — this skill does not
redefine that template, it fills it with game-specific content. Read
`references/integration-contract.md` (in the same directory as this skill) before
Phase 3 — it is the concrete platform contract every generated spec must satisfy; it is
this skill's own addition on top of `/spec`, not a replacement for it.

If anything in this document is ambiguous about _process_ (as opposed to game-specific
content), defer to `.claude/skills/spec/SKILL.md`'s instructions rather than improvising.

## Command flow

- Follow the six phases in order. Do not skip phases.
- Your replies must be in the same language as the initial prompt. E.g.: if the initial
  prompt is in Spanish, your replies and the generated spec must be in Spanish; if it is
  in English, use English throughout.
- This skill only ever writes one file: `specs/NN-slug.md`, in `Draft` state. It never
  touches `lib/`, `components/`, `app/`, or Supabase.

### Phase 1 — Context

Before analyzing anything, load the platform's actual state:

1. Read `.claude/skills/spec/SKILL.md` in full — this is the process you are running.
   Its Phase 1 ("Understand the context") is itself part of what you're executing right
   now, so keep going through its own steps too: it will have you read the
   project-memory file and the most recent existing specs, which items 2-3 below cover
   in more game-specific detail.
2. Read `CLAUDE.md` (it imports `AGENTS.md`) for the project's stack notes and hard
   rules (Next.js 16 Proxy vs Middleware, Cache Components, etc.) — a spec that
   contradicts those will fail during implementation.
3. List `specs/` to find the next sequential number and see what already shipped.
4. Read `specs/05-asteroides-game-engine.md` and `specs/06-leaderboard-y-catalogo-supabase.md`
   in full. These two specs **are** the contract in its original form — asteroids is the
   only game that has gone through this path end-to-end, and its spec is the closest
   thing to a worked example.
5. Read `.claude/skills/spec/template.md` for the section shapes.
6. Read `references/integration-contract.md` (next to this file) — the condensed,
   reusable version of what steps 4-5 taught, with file/line anchors into the current
   codebase (not just the historical spec text).

### Phase 2 — Identify the game's source

- List `references/started_games/`.
- Fuzzy-match `$ARGUMENTS` against those folder names (e.g. `tetris` → `03-tetris`,
  `arkanoid` → `04-arkanoid`, `asteroids`/`asteroides` → `02-asteroids`, already shipped).
- **Match found → PORT mode.** Confirm the folder with the user before reading it.
- **No match, or `$ARGUMENTS` describes a game not in that folder → SCRATCH mode.** Ask
  the user for a one-sentence description of the game if they haven't given one.
- **`$ARGUMENTS` empty →** list the available reference folders and ask which one, or
  whether this is a from-scratch game.

Never assume PORT mode without a folder match, and never invent gameplay for SCRATCH
mode without asking — this phase exists to stop guessing before it starts.

### Phase 3 — Analyze the source

**PORT mode:** Read `index.html`, every `.js` file it loads (there may be more than
one — check `<script src="...">` order), `README.md`, and `CLAUDE.md` inside the
matched folder.

Treat the reference `CLAUDE.md` as **advisory, not authoritative** — it can drift from
the code it describes (documented drift exists in the `04-arkanoid` reference: tuning
values, level indexing, and state shape all differ from what `game.js` actually does).
When they disagree, the code wins; note the discrepancy in the spec's Data model so the
implementer doesn't get surprised later.

Produce a **portability summary** and walk the user through it before asking the
Phase 4 questions — each row below is something the platform's fixed shell forces a
decision on, not a detail to quietly assume:

| Item                                 | Why it matters                                                                                                                                                                                                                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| World size (`<canvas width/height>`) | `.crt-screen` is a fixed `aspect-ratio: 4/3`; the canvas component stretches world→backing-store, it does not letterbox. A world that isn't already 4:3 will visibly distort unless the spec makes an explicit call.                                                                           |
| Tuning constants                     | Become the Data model's constants — ported verbatim by default.                                                                                                                                                                                                                                |
| Global state / entities              | Become the engine's private classes and the `<Name>State` shape.                                                                                                                                                                                                                               |
| Controls (`e.code` → action)         | Become the `KEY_MAP` and the `<Name>Input` type.                                                                                                                                                                                                                                               |
| Score / lives / level                | Must map onto the shell's fixed HUD (`Puntuación`/`Vidas`/`Nivel`) — note if the game has no concept of lives.                                                                                                                                                                                 |
| DOM dependencies to strip            | Reference games freely use `getElementById`, `textContent`, DOM overlays, extra `<canvas>` elements, buttons. None of that exists in the platform shell — anything the game shows outside the single game canvas needs a plan (fold into the canvas draw, map to the shell's HUD, or drop it). |
| Assets (images/audio)                | The platform ships zero image assets and no sound today (out of scope in specs 05/06). A reference game with a spritesheet or `.mp3` files needs an explicit in/out-of-scope call, not a silent carry-over.                                                                                    |
| Non-keyboard input                   | Mouse/click controls in a reference game (paddle-by-mouse, click-to-navigate) have no equivalent in the shell's keyboard-only contract — ask how/whether to adapt them.                                                                                                                        |
| Extra source files                   | Some reference games split logic across multiple scripts (e.g. a separate levels/data file) — decide whether that split survives the port into `lib/games/<slug>/`.                                                                                                                            |

**SCRATCH mode:** same table, but every row comes from a question to the user instead
of source analysis — do not skip rows just because there's no code to read.

### Phase 4 — Clarifying questions

Ask in blocks of 3-5, following `/spec`'s own convention (not one question at a time).
Wait for each block's answer before continuing. These are the game-specific questions
this platform's contract always forces — general spec questions (persistence, error
states, etc.) still apply too if something about this particular game raises them.

1. **Catalog identity** — `id` (English, URL-safe slug — note existing convention:
   `asteroids` not `asteroides`, even though the folder/title are Spanish), `title`
   (Spanish, uppercase display form), `short`/`long` descriptions, `cat`
   (`ARCADE|PUZZLE|SHOOTER|VERSUS`), `color` (`cyan|magenta|yellow|green`), `plays`
   (static mock string, consistent with every other catalog entry).
2. **New row vs. existing placeholder.** The catalog already has 8 placeholder games
   with no real engine yet (`rocas`, `bloque-buster`, `caida`, `serpentina`, `gloton`,
   `invasores`, `ranaria`, `duelo-pixel`) — several are thematically close to the
   reference games (`bloque-buster` ≈ arkanoid/breakout, `caida` ≈ tetris/falling-blocks).
   Ask explicitly: does this spec `UPDATE` one of those existing rows once it has a real
   engine, or `INSERT` a brand-new row and leave the placeholder untouched? This is the
   exact `rocas` vs `asteroids` decision from spec 05 — recommend leaving the placeholder
   alone and inserting new unless the user has a specific reason to repurpose it.
3. **Cover art** — reuse one of the existing `cover-*` CSS classes (see the integration
   contract for the full list) or write a new pure-CSS one.
4. **Aspect ratio**, only if Phase 3 found the world isn't already 4:3 — letterbox
   inside the canvas (world stays its native ratio, padding fills the rest) or redesign
   the world to fit 4:3. This is a mandatory question when it applies, never an
   assumption.
5. **HUD mapping** — the shell's HUD has three fixed slots (Puntuación/Vidas/Nivel) plus
   one conditional fifth slot for a game-specific stat. Does this game have lives at
   all? What, if anything, goes in the fifth slot (e.g. a line/combo counter)?
6. **Controls** — the `e.code` → input-field map. If Phase 3 found non-keyboard input,
   resolve it here: drop it, or design a keyboard equivalent.
7. **Assets** — confirm sound/images are out of scope (consistent with specs 05/06)
   unless the user explicitly wants them in, in which case ask where they'd live.
8. **Registry refactor.** `components/GamePlayerClient.tsx` currently branches on a
   single hardcoded `game.id === "asteroids"` check in five places (canvas render, HUD
   values, the extra HUD stat, the "RENDIRSE"/"FIN" label, and the save-score modal
   branch). Adding a second game the same way means five more branches, and it only
   gets worse from there. Recommend extracting a small `components/games/registry.ts`
   (id → canvas component + HUD metadata) as part of this spec's implementation plan,
   so `GamePlayerClient` stops growing per-game conditionals. Default recommendation:
   do the refactor now, as this spec's first implementation step — ask for confirmation
   rather than assuming.
9. **Out of scope** — touch controls, sound, real `plays` tracking, and any difficulty
   retuning are out by default (matching specs 05/06); confirm nothing else needs
   calling out.

### Phase 5 — Build the spec section by section

Follow `.claude/skills/spec/template.md`'s section order exactly, and follow
`.claude/skills/spec/SKILL.md`'s Phase 3 rhythm precisely: show one section at a time,
ask "Does this section stay like this or do you want to tweak it?", apply requested
changes and re-show, and only move on once the user confirms. Never generate the full
spec in a single response — that rule from `/spec` applies here without exception.
Minimum content per section, informed by Phases 1-4:

- **Header** — `Depends on: 05-asteroides-game-engine, 06-leaderboard-y-catalogo-supabase`
  (this spec builds on that established contract).
- **Scope — In:** the engine port/build, the canvas component, the shell
  wiring/registry work, the Supabase migration for the catalog row, and any new cover
  CSS. **Out:** touch controls, sound, real `plays`, other catalog games, difficulty
  changes — whatever Phase 4 Q9 confirmed.
- **Data model** — the engine's public API (`WORLD_W`/`WORLD_H`, `<Name>Input`,
  `<Name>State` with at minimum `status`/`score`/`lives`/`level` plus any game-specific
  fields), the canvas component's props (the same fixed four as `AsteroidesCanvas`),
  the exact `games` row values, and the `apply_migration` SQL. If the source's
  `CLAUDE.md` disagreed with its code (Phase 3), note which value the spec is trusting
  and why.
- **Implementation plan** — adapt the seven-step reusable skeleton from the integration
  contract to this game; each step must leave the app buildable.
- **Acceptance criteria** — the reusable base checklist from the integration contract,
  parameterized with this game's id/mechanics, plus any criteria specific to what makes
  this game's mechanics distinct (e.g. line-clear scoring, level-based speed curve).
- **Decisions** — `**Sí:**`/`**No:**` (or the equivalent in the working language)
  bullets with a one-line reason each, including the registry-refactor call and the
  new-row-vs-placeholder call from Phase 4.
- **Identified risks** — the recurring ones from the integration contract (Strict Mode
  double-loop, keyboard listener leaks, canvas resize/aspect-ratio distortion, DOM
  coupling inherited from the reference source) plus anything specific to this game
  (e.g. an asset pipeline, a non-obvious physics edge case).
- **What is not in this spec** — mirror the Scope's Out-of-scope list.

### Phase 6 — Save

1. Determine the next sequential number from `specs/`.
2. Propose a slug from the game's `id`/title and confirm the exact filename with the
   user before writing.
3. Write `specs/NN-slug.md` with all approved sections. State: **`Draft`**. Never mark
   it `Approved`/`Aprobado` automatically — that's a human action.
4. Same as `/spec`'s own Phase 4: if `specs/.spec-config.yml` doesn't exist yet, seed it
   with the default `AutoCreateBranch: true` content from `.claude/skills/spec/SKILL.md`.
   If it already exists, leave it untouched.
5. Confirm to the user: the file path, that it's in `Draft` state and needs a manual
   review + status change, and that `/spec-impl NN-slug` is the next step once approved.
6. **Stop here.** Do not propose implementing, writing the engine, or touching any code.

## Hard rules

- **Never write code.** The only file this skill produces is the spec's `.md`.
- **Never mark the spec `Approved`.** That is always a human decision.
- **Never propose implementation** after saving — that's `/spec-impl`'s job.
- **Never silently assume** world aspect ratio, asset handling, or non-keyboard input
  behavior — Phase 3/4 exist precisely to force those decisions into the open.
- **Code over docs when they conflict.** If a reference game's `CLAUDE.md` disagrees
  with its `game.js`, trust the code and record the discrepancy.
- **If the feature is bigger than "one new game"** (e.g. the user also wants a generic
  `GameEngine` abstraction across all games, or multiplayer, or a whole new catalog
  category), point out that belongs in its own spec and confirm it's out of scope here.

## Arguments

If invoked as `/spec-game tetris`, use it to fuzzy-match against
`references/started_games/` in Phase 2 before asking anything else. If invoked as
`/spec-game` with no arguments, start Phase 2 by listing the available reference
folders and asking which one (or whether this is a from-scratch game).
