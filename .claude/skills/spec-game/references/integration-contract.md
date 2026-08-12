# Arcade Vault — game integration contract

This is the concrete, current-state contract every new playable game must satisfy to
plug into Arcade Vault. It is derived from `specs/05-asteroides-game-engine.md` and
`specs/06-leaderboard-y-catalogo-supabase.md` — the two specs that shipped the only game
that has gone through this path so far (`asteroids`) — condensed and pointed at the
actual files as they exist today. `/spec-game`'s Phase 3 and Phase 5 lean on this
document; read it before drafting the Data model and Implementation plan sections.

File/line references below may drift slightly as the codebase evolves — if a quoted
line number looks wrong, re-read the file, the shape described should still hold.

---

## A. Engine contract — `lib/games/<slug>/engine.ts`

Live example: `lib/games/asteroides/engine.ts` (~490 lines). A new engine is
framework-agnostic TypeScript with **zero** React/DOM dependencies — no `window`,
`document`, or `requestAnimationFrame` inside it.

Exactly five things are exported; everything else (entity classes, helpers, tuning
constants) stays module-private:

```ts
export const WORLD_W = 800; // fixed logical world size, in world units (not px)
export const WORLD_H = 600;

export type <Name>Input = {
  // one boolean/number field per control the game reads each frame
  left: boolean;
  right: boolean;
  // ...
};

export type <Name>State = {
  status: "playing" | "dead" | "gameover"; // the game-over channel a canvas polls
  score: number;
  lives: number; // omit only if the game genuinely has no lives concept
  level: number;
  // + any game-specific fields (e.g. tripleShotRemaining, linesCleared)
};

export class <Name>Engine {
  constructor();                                   // calls reset()
  reset(): void;                                    // full re-init; same instance survives restarts
  update(dt: number, input: <Name>Input): void;      // dt in seconds, framerate-independent
  draw(ctx: CanvasRenderingContext2D): void;         // clears + paints in WORLD_W×WORLD_H coords only
  getState(): <Name>State;                           // the only read path into engine state
}
```

Rules:

- All state is `private`; `getState()` is the only way anything outside reads it.
- `update(dt, input)` uses seconds-based constants (px/s, px/s², rad/s) so the game
  isn't tied to a fixed frame rate.
- `draw(ctx)` clears the canvas first, then paints layers back-to-front, in world
  coordinates only — scaling to the real backing store is the **canvas component's**
  job, never the engine's.
- Edge-triggered inputs (a single shot per key-press, not a stream while held) are
  resolved **inside** the engine with a private "previous frame" flag (e.g.
  `private prevShoot: boolean`), not in the component. The component only ever sets
  plain booleans on the input object.
- `reset()` must fully re-initialize every field so the same `Engine` instance can be
  reused across a "JUGAR DE NUEVO" restart without recreating it.

---

## B. Canvas component template — `components/games/<Name>Canvas.tsx`

Live example: `components/games/AsteroidesCanvas.tsx` (~156 lines). Copy this file's
structure for a new game; only the engine import, `KEY_MAP`, and any extra props change.

**Props — fixed, do not add to this shape without a strong reason:**

```ts
type <Name>CanvasProps = {
  paused: boolean;
  onStateChange: (state: <Name>State) => void; // called every frame (~60 Hz)
  onGameOver: (finalScore: number) => void; // called exactly once per run
  restartSignal: number; // parent increments this to trigger reset()
};
```

**Patterns to replicate exactly:**

- The mounting effect runs once (`useEffect(..., [])`). Because of that, every prop
  that can change over the component's life must be mirrored into a ref
  (`pausedRef`, `onStateChangeRef`, `onGameOverRef`, each synced by its own tiny
  `useEffect`) so the `requestAnimationFrame` closure always reads the current value.
- `KEY_MAP: Record<string, keyof <Name>Input>` maps `e.code` → input field.
  `keydown`/`keyup` listeners go on `window`, call `e.preventDefault()` **only** for
  mapped codes (so unrelated keys/scrolling on the rest of the page still work), and
  mutate a plain, non-reactive `input` object — never `useState` for per-frame input,
  it would cause 60 re-renders/second for nothing.
- DPR + responsive sizing: on mount and on every `ResizeObserver` firing on the canvas
  element, recompute the backing-store size from `canvas.clientWidth/Height *
  devicePixelRatio`, then reset the transform so world units map to pixels:
  ```ts
  ctx.setTransform(pixelW / WORLD_W, 0, 0, pixelH / WORLD_H, 0, 0);
  ```
  Setting `canvas.width`/`canvas.height` resets the transform as a side effect, so
  `setTransform` must run again after every resize, not just once at mount.
- The RAF loop clamps `dt` to 50ms (`Math.min((ts - lastTime) / 1000, 0.05)`) to avoid
  physics explosions after a tab-switch pause. While `paused` is true, skip
  `engine.update()` but still call `engine.draw()` so the frozen frame stays visible.
- `onStateChange` fires every frame — the parent **must** pass a `useCallback`-stable
  function or it'll do nothing but shouldn't be a perf trap either way.
- `onGameOver` fires exactly once: latch it with a ref flag set the first time
  `getState().status === "gameover"` is observed, checked before calling.
- `restartSignal`: a separate effect keyed on this prop, which must skip its very
  first invocation (so mounting doesn't immediately reset), then calls
  `engine.reset()` and clears the game-over latch.
- Cleanup on unmount: `cancelAnimationFrame`, `resizeObserver.disconnect()`, remove
  both keyboard listeners, and null out the engine ref. Missing any of these causes
  either a doubled-speed game under React Strict Mode (RAF not cancelled) or keyboard
  input leaking into other pages (listeners not removed).
- Markup: a `.game-arena` wrapper `div` containing one absolutely-positioned canvas
  (`position: absolute; inset: 0; width: 100%; height: 100%; display: block`). The
  wrapper is what gives the canvas its box; the canvas itself has no intrinsic size.

---

## C. Shell wiring — `components/GamePlayerClient.tsx`

The shared game shell. Today it identifies the one real game with a single hardcoded
flag near the top of the file:

```tsx
const isAsteroides = game.id === "asteroids";
```

...and branches on it in five places: the canvas render (swap the static demo
`.game-arena` markup for the real `<AsteroidesCanvas />` only for this game), the HUD
values (`score`/`lives`/`level` read from real engine state vs. hardcoded demo
constants), an extra conditional `hud-stat` chip for a game-specific readout, the
"RENDIRSE"/"FIN" button label, and the save-score branch inside the end-of-game modal
(playable games get an initials input + save button; placeholder games get a
"this game doesn't save scores yet" message).

**Adding a second game the same way means five more `=== "id"` branches, and it keeps
compounding per game.** `/spec-game` should recommend — and by default schedule as the
first implementation step — extracting a small registry so `GamePlayerClient` stops
growing per-game conditionals:

```ts
// components/games/registry.ts
export type GameEntry = {
  Canvas: React.ComponentType<GameCanvasProps>;
  // HUD metadata: does it have lives, what's the 5th stat's label/selector, etc.
  hasLives: boolean;
  extraStat?: { label: string; select: (state: unknown) => string | null };
};

export const GAME_REGISTRY: Record<string, GameEntry> = {
  asteroids: { Canvas: AsteroidesCanvas, hasLives: true, extraStat: { ... } },
  // new game's id goes here, once
};
```

`GamePlayerClient` then looks up `GAME_REGISTRY[game.id]` once instead of repeating
`game.id === "..."` checks — a new game adds one registry entry, not five branches.
This refactor is **not mandatory for a one-off** but is the recommended default from
the second real game onward; `/spec-game` should ask, not assume (see SKILL.md Phase 4
Q8).

---

## D. Data layer

There is **no static `GAMES` array anymore** — it was removed in spec 06. A new game's
catalog entry is a Supabase `INSERT`/`UPDATE`, never a `lib/data.ts` edit.

Available functions (server, `lib/data.ts`): `getGames()`, `getGameById(id)`,
`getTopScores(gameId, limit)`, `getBestScore(gameId)`. Client-only (`lib/data-client.ts`):
`getPlayerBest(gameId, name)`. Score saving (`lib/session.ts`):

```ts
export async function saveScore(entry: {
  game: string; // becomes game_id in the insert
  score: number;
  name: string;
}): Promise<{ ok: true } | { ok: false; error: string }>;
```

`saveScore` never throws — it returns a result object; the caller renders `error` on
failure. Supabase clients live in `utils/supabase/{client,server}.ts`, both exported as
`createClient` (server one is `async`, wraps cookies).

**No changes needed** for a new game in: `app/game/[id]/play/page.tsx`,
`app/game/[id]/page.tsx`, `app/games/page.tsx`, `app/hall-of-fame/page.tsx` — all four
iterate generically over whatever `getGames()`/`getGameById()` return.

---

## E. Supabase migration

`games` table columns: `id, title, short, long, cat, cover, color, plays, created_at`.
Constraints to respect: `cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS')`, `color in
('cyan','magenta','yellow','green')`. `best` is **not** a column — it's computed as
`max(score)` over `scores` filtered by `game_id`.

Template for the spec's migration step (apply via the Supabase MCP's `apply_migration`
during implementation, not during `/spec-game` itself):

```sql
insert into games (id, title, short, long, cat, cover, color, plays)
values (
  '<id>', '<TITLE>', '<short>', '<long>',
  '<ARCADE|PUZZLE|SHOOTER|VERSUS>', '<cover-class>',
  '<cyan|magenta|yellow|green>', '0'
);
```

**No `scores` seed.** Unlike the original spec-06 migration (which seeded all 9
catalog entries so no leaderboard started empty), a new game built via `/spec-game`
already has a real engine from day one — its leaderboard fills from actual play, so
seeding mock scores would just be noise to clean up later.

---

## F. CSS anchors — `app/globals.css`

- `.crt-screen` (~line 623): `position: relative; aspect-ratio: 4 / 3;` — this is what
  forces every game's world to map onto a 4:3 box; see the aspect-ratio question in
  SKILL.md Phase 4.
- `.game-arena` (~line 670): the wrapper both the static demo arena and the real canvas
  component use for positioning.
- Nine existing `cover-*` classes (~lines 396-511), all pure CSS (no image assets in
  the project): `cover-bricks`, `cover-tetro`, `cover-snake`, `cover-glot`,
  `cover-invaders`, `cover-rocas`, `cover-rana`, `cover-duelo`, plus the shared
  `.cover-bg` base every one of them pairs with. A new game either reuses one of these
  (as `asteroids` reused `cover-rocas`) or adds a new `.cover-<name>` block in this
  section, following the same pure-CSS-art technique (gradients/clip-path/pseudo
  elements, no images).
- HUD/modal classes if referenced by a game-specific stat: `.hud-stat` (+ `.l`, `.v`,
  `.lives`, `.level` modifiers), `.modal-bd`/`.modal`, `.toast-saved`.

---

## G. Reusable Implementation plan skeleton

Seven steps, adapted per game. Steps 1 only applies the first time the registry
refactor (section C) is adopted:

1. *(first registry-adopting spec only)* `components/games/registry.ts` +
   refactor `GamePlayerClient.tsx` from the hardcoded flag to a registry lookup.
2. `lib/games/<slug>/engine.ts` — port or author the engine per section A.
3. `components/games/<Name>Canvas.tsx` — copy the template per section B, swap the
   engine import and `KEY_MAP`.
4. Register the game (registry entry, or the flag/branches if no registry yet) +
   wire any extra `hud-stat`.
5. Supabase migration: `INSERT`/`UPDATE` the `games` row (section E).
6. New `cover-*` CSS class, if not reusing an existing one (section F).
7. Manual QA (play a full run, verify HUD/pause/restart/game-over/save) +
   `npm run build` + `npm run lint`.

Each step must leave the app in a buildable state — same rule as `/spec`'s own
Implementation plan section.

---

## H. Reusable Acceptance criteria base

Parameterize these with the game's id/mechanics (drawn from spec 05's own criteria,
`specs/05-asteroides-game-engine.md:151-167`):

- [ ] `games` includes the new row with the fields defined in Data model; no other
      catalog row is changed (unless Phase 4 Q2 chose to `UPDATE` a placeholder).
- [ ] `/game/<id>` (Detail) shows the game's info and "JUGAR AHORA" navigates to
      `/game/<id>/play`.
- [ ] `/game/<id>/play` renders the real canvas inside `.crt-screen`, scaled to the
      container without distorting the intended aspect ratio.
- [ ] All mapped controls work as specced; wrapping/bounds behave as designed.
- [ ] Core scoring mechanic(s) award points exactly as specced.
- [ ] The HUD (Puntuación, Vidas if applicable, Nivel, + any extra stat) reflects real
      engine state every frame, not fixed demo values.
- [ ] Game over triggers correctly and opens the existing end-of-game modal with the
      real accumulated score.
- [ ] "RENDIRSE" ends the run manually at any point with the real score so far.
- [ ] Saving a score in the modal inserts a real row into Supabase `scores` (via
      `saveScore`) and shows the saved confirmation.
- [ ] "JUGAR DE NUEVO" resets the engine to a clean state without a page reload.
- [ ] PAUSA fully freezes the engine (no physics/input processed) and shows the
      existing pause overlay; REANUDAR continues exactly where it left off.
- [ ] "SALIR" navigates away without console errors and without the loop continuing
      in the background.
- [ ] Leaving `/game/<id>/play` and returning starts clean — no residual state or
      leaked keyboard listeners from the previous visit.
- [ ] The rest of the catalog (all other games) keeps its existing behavior unchanged.
- [ ] `npm run build` and `npm run lint` finish without errors.

---

## I. Known pitfalls per reference game

| Reference | Pitfalls to flag in Phase 3 |
|---|---|
| `references/started_games/02-asteroids` | Already shipped as `asteroids` — read it as the live worked example, not something to re-port. Its own `CLAUDE.md` under-documents the triple-shot power-up (present in code, absent from the doc). |
| `references/started_games/03-tetris` | World is `300×600` (canvas attributes) — a **1:2** ratio, not 4:3; will distort under the shell's stretch-to-fit unless Phase 4 Q4 resolves it. HUD is DOM-based (`#score`/`#lines`/`#level` text content) and there's a separate `#overlay` div and a second `<canvas id="next-canvas">` for the piece preview — none of that exists in the shell, needs an explicit plan (most likely folding into the main canvas draw + HUD chip). The game has **no lives** concept. `PIECES` has 8 entries (7 standard tetrominoes + one custom "nut" piece) — note it, don't silently drop it while porting. |
| `references/started_games/04-arkanoid` | Splits logic across three scripts loaded in order (`assets/spritesheet.js`, `levels.js`, `game.js`) — decide whether that split survives into `lib/games/<slug>/`. Uses a PNG spritesheet and two `.mp3` files — the platform ships neither today, forces an explicit assets decision. Paddle is controlled by `mousemove` and there's a `click`-based level-select overlay — both need a keyboard-only redesign or an explicit scope cut. Its own `CLAUDE.md` disagrees with the code in at least four places (a `speed` vs `ballSpeedMultiplier` naming mismatch, paddle width, level indexing base, and the `gameState` enum's members) — trust `game.js`/`levels.js`, not the doc. The catalog already has a `bloque-buster` placeholder that's thematically the closest match — surface the new-row-vs-placeholder question (Phase 4 Q2) explicitly for this one. |
