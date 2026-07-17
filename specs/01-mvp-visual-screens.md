# SPEC 01 — Pantallas visuales del MVP

> **Status:** implementado
> **Depends on:** ninguna
> **Date:** 2026-07-16
> **Objective:** Portar las 5 pantallas del prototipo estático en `references/templates/` (biblioteca, detalle, jugar, login y salón de la fama) a rutas reales de Next.js App Router, como maqueta visual funcional sin implementar ningún motor de juego real.

## Scope

**In:**

- Pantalla Biblioteca en `/` — hero, buscador, chips de categoría, grid de tarjetas con efecto tilt al pasar el mouse.
- Pantalla Detalle en `/game/[id]` — info del juego, tabla de mejores puntuaciones (mock), botones "JUGAR AHORA" / "VOLVER AL VAULT".
- Pantalla Jugar en `/game/[id]/play` — shell visual estático: CRT decorativo, HUD con valores fijos de ejemplo, botones PAUSA y FIN interactivos (togglean overlay de pausa y modal de fin), sin auto-incremento de puntaje ni bucle de juego real.
- Pantalla Login en `/login` — tabs "Iniciar sesión" / "Crear cuenta", botón de invitado, mock de autenticación sin validación real (cualquier valor autentica).
- Pantalla Salón de la Fama en `/hall-of-fame` — tabs por juego, podio top 3, tabla de puntuaciones, fila "tu mejor marca" cuando hay sesión.
- Nav compartida (enlaces desktop + panel hamburguesa móvil) y footer, ambos en el layout raíz, reflejando el estado de sesión.
- Data mock portada a `lib/data.ts` (GAMES, CATS, PLAYERS, seededScores).
- Persistencia de sesión (`av_user`) y puntajes guardados (`av_scores`) vía localStorage, igual que el prototipo.
- Comportamiento responsive ya presente en `app/globals.css` (los breakpoints del template ya están portados).

**Out of scope (for future specs):**

- Motor de juego real para cualquiera de los 8 juegos del catálogo (Bloque Buster, Caída, Serpentina, etc.) — una spec por juego si corresponde.
- Backend/autenticación real (API, base de datos, sesiones de servidor).
- Cálculo real de puntuaciones o actualización del leaderboard a partir de partidas reales.
- Login social (Google/GitHub) — los botones quedan como decorativos, sin funcionalidad.
- Sonido/haptics.
- Suite de pruebas automatizadas (no hay test runner configurado en el proyecto todavía).

## Data model

`lib/data.ts` — port directo de `data.jsx` a TypeScript, sin cambios de forma:

```ts
export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string; // clase CSS del cover generado (cover-bricks, cover-tetro, ...)
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string;
}

export const GAMES: Game[]; // los mismos 8 juegos del prototipo
export const CATS: string[]; // ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"]
export const PLAYERS: string[]; // nombres para generar leaderboards mock

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;
}

export function seededScores(seed: number, count?: number): ScoreRow[];
```

Estado de sesión y puntajes (client-side, sin modelo de servidor):

```ts
// localStorage "av_user"
type StoredUser = { name: string } | null;

// localStorage "av_scores"
type SavedScore = { game: string; score: number; name: string; at: number };
```

Convenciones:

- `Game.color` mapea a las variantes de botón (`.btn.magenta`, `.btn.yellow`, default cyan) ya definidas en `globals.css`.
- `seededScores` es una función determinística (PRNG lineal simple) — mismo comportamiento que el original, sin `Math.random()`.

## Implementation plan

1. Portar la data mock a `lib/data.ts` (tipos `Game`, `ScoreRow`, arrays `GAMES`/`CATS`/`PLAYERS`, función `seededScores`).
2. Crear helpers de sesión en `lib/session.ts` (`getStoredUser`, `setStoredUser`, `clearStoredUser`, `saveScore`) que envuelven `localStorage` con las claves `av_user` / `av_scores`.
3. Diferenciar `app/globals.css` contra `references/templates/styles.css` y portar cualquier selector faltante (deberían ser mínimos, ya están casi idénticos).
4. Construir `components/Nav.tsx` (client component): enlaces desktop, panel hamburguesa móvil, botón de sesión (nombre de usuario o "Iniciar Sesión"); integrarlo en `app/layout.tsx` junto con el footer ya presente en `app.jsx`.
5. Construir `components/GameCard.tsx` con el efecto tilt al mover el mouse, reutilizable desde la Biblioteca.
6. Implementar `/` (Biblioteca) en `app/page.tsx`: hero, buscador, chips de categoría, grid con `GameCard` enlazando a `/game/[id]`.
7. Implementar `/game/[id]` (Detalle) en `app/game/[id]/page.tsx`: cover, tags, descripción, stat strip, leaderboard (`seededScores`), botones "JUGAR AHORA" / "VOLVER".
8. Implementar `/game/[id]/play` (Jugar) en `app/game/[id]/play/page.tsx`: CRT decorativo, HUD con valores fijos, botón PAUSA que muestra/oculta el overlay "EN PAUSA", botón FIN que abre el modal de fin de partida con puntaje fijo de ejemplo, formulario de guardar puntuación que usa `saveScore`, botones "JUGAR DE NUEVO" / "VOLVER AL VAULT".
9. Implementar `/login` (Login) en `app/login/page.tsx`: tabs iniciar sesión/crear cuenta, campos sin validación, botón invitado, botones sociales decorativos; el submit llama a `setStoredUser` y redirige a `/`.
10. Implementar `/hall-of-fame` en `app/hall-of-fame/page.tsx`: tabs por juego, podio top 3, tabla de puntuaciones, fila "tu mejor marca" cuando hay sesión activa.
11. Ajustar el estado activo de los enlaces del Nav usando `usePathname()` y confirmar que "cerrar sesión" limpia `av_user` y actualiza la UI.
12. QA manual: navegar las 5 rutas, verificar breakpoints móviles, correr `npm run build` y `npm run lint` sin errores.

## Acceptance criteria

- [ ] `/` muestra el hero, el buscador filtra las tarjetas por título, y los chips filtran por categoría.
- [ ] Cada tarjeta de juego enlaza a `/game/[id]` con el `id` correcto.
- [ ] `/game/[id]` muestra la info del juego, la tabla de mejores puntuaciones y el botón "JUGAR AHORA" navega a `/game/[id]/play`.
- [ ] `/game/[id]/play` muestra el HUD con valores fijos, el CRT decorativo, y el botón PAUSA alterna el overlay "EN PAUSA".
- [ ] En `/game/[id]/play`, el botón FIN abre el modal de fin de partida con un puntaje fijo de ejemplo.
- [ ] Guardar puntuación en el modal escribe una entrada en `localStorage["av_scores"]` y muestra el mensaje "PUNTUACIÓN GUARDADA".
- [ ] `/login` permite iniciar sesión con cualquier texto en el campo usuario, guarda `localStorage["av_user"]` y redirige a `/`.
- [ ] `/login` permite entrar como invitado sin guardar nombre y redirige a `/`.
- [ ] Tras iniciar sesión, el Nav muestra el nombre de usuario en vez de "Iniciar Sesión", y "cerrar sesión" limpia `localStorage["av_user"]`.
- [ ] `/hall-of-fame` muestra podio y tabla por cada juego seleccionado en los tabs, y la fila "tu mejor marca" solo aparece con sesión activa.
- [ ] El panel móvil del Nav (hamburguesa) abre y cierra correctamente en viewport angosto (< 840px).
- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] Ninguna de las 5 pantallas ejecuta lógica de un juego real (sin bucle de juego, sin colisiones, sin `setInterval` incrementando puntaje).

## Decisions

- **Sí:** rutas en inglés (`/game/[id]`, `/game/[id]/play`, `/login`, `/hall-of-fame`). Convención más común en código Next.js, aunque la UI es en español.
- **No:** rutas en español (`/juego/[id]`, `/salon-de-la-fama`). Descartado por consistencia con el estilo de código del resto del proyecto.
- **Sí:** pantalla Jugar como shell estático sin auto-incremento de puntaje. Cumple "solo visual, sin implementar ningún juego" sin perder la posibilidad de ver los estados de pausa y fin de partida.
- **No:** mantener el `setInterval` que sube el puntaje solo, como en el prototipo original. Simularía un juego real, lo cual está fuera de alcance.
- **Sí:** persistencia en `localStorage` para sesión y puntajes guardados, replicando `av_user` / `av_scores` del original. Mantiene fidelidad visual/funcional sin requerir backend.
- **Sí:** autenticación mock sin validación (cualquier valor en el formulario autentica), igual que el original. Es una maqueta visual, no un sistema de auth real.
- **Sí:** `lib/data.ts` para la data mock. Convención estándar de Next.js para código compartido fuera de `app/`.
- **Sí:** reutilizar `app/globals.css` tal cual, con una verificación de paridad contra `styles.css` en vez de reescribirlo desde cero. Ya está casi 1:1 portado (952 vs 950 líneas).
- **No:** implementar cualquiera de los 8 motores de juego (Bloque Buster, Caída, etc.) en este spec. Cada uno amerita su propia spec futura.
- **No:** login social funcional (Google/GitHub). Quedan como botones decorativos, sin acción real.

## What is **not** in this spec

- Motores de juego reales para los 8 juegos del catálogo.
- Backend o autenticación real.
- Login social funcional.
- Sonido/haptics.
- Suite de pruebas automatizadas.

Cada uno de estos, si se implementa, va en su propia spec.
