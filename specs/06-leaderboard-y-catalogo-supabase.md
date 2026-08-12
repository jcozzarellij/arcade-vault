# SPEC 06 — Catálogo de juegos y leaderboard reales en Supabase

> **Status:** Aprobado
> **Depends on:** 04-supabase-sdk-integration, 05-asteroides-game-engine
> **Date:** 2026-08-04
> **Objective:** Migrar el catálogo de juegos y los leaderboards desde datos estáticos/mock (`lib/data.ts`) a tablas reales de Supabase (`games` y `scores`), conectando las 5 pantallas que hoy los leen, calculando `best` dinámicamente desde los puntajes reales, y limitando el guardado de puntuaciones a Asteroides (único juego con motor real hoy).

## Scope

**In:**

- Crear tabla `games` en Supabase (id, title, short, long, cat, cover, color, plays) — sin columna `best` fija, ya que se calcula.
- Crear tabla `scores` en Supabase (id, game_id FK → games, name, score, created_at) con constraints básicos: score entero positivo, name no vacío con longitud máxima razonable, game_id debe existir.
- RLS: lectura pública en ambas tablas; inserción pública solo en `scores` (no hay auth todavía).
- Seed inicial: poblar `games` con las 9 entradas actuales de `lib/data.ts`; poblar `scores` con datos semilla equivalentes a los que hoy genera `seededScores`, para los 9 juegos (incluido `asteroids`), así ningún leaderboard arranca vacío.
- `lib/data.ts`: reemplazar el array estático `GAMES` y la función `seededScores` por funciones de fetch a Supabase (server-side): `getGames()`, `getGameById(id)`, `getTopScores(gameId, limit)`, `getBestScore(gameId)`. Se mantiene el tipo `Game` (ahora sin `best` fijo) y `ScoreRow`.
- `lib/session.ts`: `saveScore()` pasa a ser asíncrona e inserta en la tabla `scores` de Supabase; deja de escribir en `localStorage["av_scores"]`.
- Actualización de las 5 pantallas que leen el catálogo/leaderboards, usando Server Component (fetch) + props al Client Component existente:
  - `app/page.tsx` (Home) — rail de 6 juegos con datos reales.
  - `app/games/page.tsx` (Biblioteca) — grid completo con datos reales; búsqueda/chips sin cambios de lógica.
  - `app/game/[id]/page.tsx` (Detalle) — ya es server; query a Supabase, `best`/`plays`/leaderboard reales.
  - `app/game/[id]/play/page.tsx` — recibe el juego vía props desde un wrapper server; botón "GUARDAR PUNTUACIÓN" deshabilitado/oculto para los 8 juegos sin motor real (solo `asteroids` guarda); `saveScore` ahora async con estado de guardado/error.
  - `app/hall-of-fame/page.tsx` — wrapper server que trae juegos + puntajes reales; "TU MEJOR MARCA" calculado con datos reales filtrando `scores` por el nombre guardado en `localStorage["av_user"]`.
- Manejo simple de error si el fetch/insert a Supabase falla (mensaje visible, sin crash de la pantalla).

**Out of scope (para specs futuras):**

- Autenticación real / login con Supabase Auth — se mantiene "nombre libre" sin cuenta, como hoy.
- Migrar los puntajes históricos ya guardados en `localStorage["av_scores"]` del navegador actual — se arranca limpio.
- Motores de juego reales para los otros 8 juegos del catálogo — siguen sin gameplay; solo su catálogo/leaderboard pasa a ser real (con datos semilla).
- Recalcular `plays` a partir de partidas reales — sigue siendo un valor mock migrado tal cual desde `lib/data.ts`.
- Rate-limiting o anti-cheat sobre los inserts públicos de `scores` — solo los constraints básicos de base de datos.
- Sonido/haptics, controles táctiles (ya fuera de alcance en spec 05).
- Cambios visuales/CSS en las 5 pantallas — solo cambia la fuente de datos, no el diseño.

## Data model

**Supabase — migración SQL** (aplicada vía `apply_migration`):

```sql
create table games (
  id text primary key,
  title text not null,
  short text not null,
  long text not null,
  cat text not null check (cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover text not null,
  color text not null check (color in ('cyan','magenta','yellow','green')),
  plays text not null default '0',
  created_at timestamptz not null default now()
);

create table scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references games(id),
  name text not null check (char_length(name) > 0 and char_length(name) <= 20),
  score integer not null check (score > 0),
  created_at timestamptz not null default now()
);

alter table games enable row level security;
alter table scores enable row level security;

create policy "games are publicly readable" on games for select using (true);
create policy "scores are publicly readable" on scores for select using (true);
create policy "anyone can insert a score" on scores for insert with check (true);
-- games: sin policy de insert/update/delete — solo se escribe vía migraciones/seed.
```

`best` de cada juego **no** es columna: se calcula con `max(score)` sobre `scores` filtrado por `game_id` (o `null`/0 si el juego no tiene puntajes).

**`lib/data.ts`** — reemplaza el array estático y `seededScores` por fetch a Supabase:

```ts
export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string;
  color: "cyan" | "magenta" | "yellow" | "green";
  plays: string;
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // formateado desde created_at
}

export const CATS: string[]; // sin cambios

export async function getGames(): Promise<Game[]>;
export async function getGameById(id: string): Promise<Game | null>;
export async function getTopScores(
  gameId: string,
  limit?: number
): Promise<ScoreRow[]>;
export async function getBestScore(gameId: string): Promise<number>; // 0 si no hay puntajes
export async function getPlayerBest(
  gameId: string,
  name: string
): Promise<{ score: number; rank: number } | null>; // para "TU MEJOR MARCA"
```

**`lib/session.ts`** — `saveScore` pasa a ser async e inserta en Supabase (cliente browser):

```ts
export type SavedScore = { game: string; score: number; name: string };

export async function saveScore(
  entry: SavedScore
): Promise<{ ok: true } | { ok: false; error: string }>;
```

`PLAYERS` (lista de nombres mock) se mantiene en `lib/data.ts` solo como insumo del script/migración de seed de `scores` — no se usa en runtime de la app.

## Implementation plan

1. Migración Supabase `create_games_and_scores_tables`: crear las tablas `games` y `scores`, constraints y policies RLS (según Data model). El frontend no cambia todavía — sigue leyendo `lib/data.ts` estático, la app sigue funcionando igual.
2. Migración/seed `seed_games_and_scores`: `INSERT` de las 9 entradas actuales del catálogo (sin `best`) en `games`, y de puntajes semilla equivalentes a los que hoy genera `seededScores` (usando la lista `PLAYERS`) en `scores`, para los 9 juegos. Verificar con `execute_sql`/`list_tables` que quedaron pobladas.
3. Agregar a `lib/data.ts` las nuevas funciones (`getGames`, `getGameById`, `getTopScores`, `getBestScore` con cliente server; `getPlayerBest` con cliente browser) **sin eliminar todavía** `GAMES`/`seededScores`, para no romper las pantallas que aún no se migraron en este mismo paso. Agregar a `lib/session.ts` la nueva `saveScore()` async (inserta en Supabase) sin quitar todavía la escritura a `localStorage`.
4. Migrar `app/game/[id]/page.tsx` (ya Server Component) a las nuevas funciones (`getGameById` + `getTopScores` + `getBestScore`), con `notFound()` si el juego no existe.
5. Dividir `app/page.tsx` (Home): mover el contenido actual a `components/HomeClient.tsx` (recibe `games: Game[]` como prop); `app/page.tsx` pasa a ser Server Component async que llama `getGames()` y renderiza `<HomeClient games={games} />`.
6. Dividir `app/games/page.tsx` (Biblioteca): mover el contenido a `components/GamesLibraryClient.tsx` (recibe `games: Game[]`); `app/games/page.tsx` pasa a ser Server Component que llama `getGames()`.
7. Dividir `app/game/[id]/play/page.tsx`: mover el contenido a `components/GamePlayerClient.tsx` (recibe `game: Game`); `app/game/[id]/play/page.tsx` pasa a ser Server Component async (`getGameById` + `notFound()`). Dentro de `GamePlayerClient`: ocultar/deshabilitar el bloque "GUARDAR PUNTUACIÓN" cuando `game.id !== "asteroids"`; el guardado pasa a `await saveScore(...)`, mostrando un estado de error si falla.
8. Dividir `app/hall-of-fame/page.tsx`: mover el contenido a `components/HallOfFameClient.tsx` (recibe `games: Game[]` y `scoresByGame: Record<string, ScoreRow[]>` ya resueltos); `app/hall-of-fame/page.tsx` pasa a ser Server Component que llama `getGames()` + `getTopScores(g.id)` para cada uno de los 9 juegos. Dentro del client: "TU MEJOR MARCA" se resuelve en un `useEffect` que llama `getPlayerBest(tab, user.name)` (cliente browser) cada vez que cambia el tab o el usuario logueado, mostrando el bloque solo si hay resultado.
9. Limpieza final: eliminar de `lib/data.ts` el array estático `GAMES`, `seededScores` y `PLAYERS` (ya no se usan en runtime, quedan solo como referencia en la migración de seed); eliminar de `lib/session.ts` la escritura a `localStorage["av_scores"]`.
10. QA manual completo (ver Acceptance criteria) + `npm run build` y `npm run lint` sin errores.

## Acceptance criteria

- [ ] Las tablas `games` y `scores` existen en Supabase con las columnas, constraints y policies RLS definidas en Data model.
- [ ] `games` contiene las 9 entradas del catálogo (mismos `id`/`title`/`short`/`long`/`cat`/`cover`/`color`/`plays` que tenía `lib/data.ts` antes de la migración).
- [ ] `scores` contiene datos semilla para los 9 juegos (al menos 10-12 filas por juego), de forma que ningún leaderboard arranca vacío.
- [ ] `lib/data.ts` ya no exporta `GAMES` (array estático) ni `seededScores`; expone `getGames`, `getGameById`, `getTopScores`, `getBestScore` y `getPlayerBest`.
- [ ] `lib/session.ts`: `saveScore()` es asíncrona, inserta en la tabla `scores` de Supabase, y ya no escribe en `localStorage["av_scores"]`.
- [ ] `/` (Home) muestra el rail "Juegos disponibles ahora" con 6 juegos reales traídos de Supabase.
- [ ] `/games` (Biblioteca) muestra el catálogo completo desde Supabase; buscador y chips de categoría siguen funcionando igual que antes.
- [ ] `/game/[id]` (Detalle) muestra `plays` real y `best` calculado como el máximo real de `scores` para ese juego (o un valor por defecto si el juego todavía no tiene puntajes); el leaderboard lateral muestra los puntajes reales de ese juego.
- [ ] `/game/asteroids/play`: jugar una partida completa, perder y guardar la puntuación escribe una fila nueva en `scores` (Supabase), visible luego en `/game/asteroids` y en `/hall-of-fame` al recargar.
- [ ] `/game/[id]/play` para cualquiera de los otros 8 juegos: el bloque "GUARDAR PUNTUACIÓN" está deshabilitado u oculto, y no se inserta ninguna fila en `scores` al pulsar "FIN".
- [ ] `/hall-of-fame`: cada tab de juego muestra el leaderboard real correspondiente (podio + tabla) traído de Supabase.
- [ ] `/hall-of-fame`: con un usuario logueado que tenga al menos un puntaje real guardado, "TU MEJOR MARCA" muestra su puntaje y rank reales calculados desde `scores`; si no tiene puntajes en ese juego, el bloque no muestra un dato inventado (se oculta o muestra estado vacío).
- [ ] Si el fetch o el insert a Supabase falla, la pantalla correspondiente muestra un mensaje de error visible en vez de crashear o quedar en blanco.
- [ ] `npm run build` y `npm run lint` terminan sin errores.

## Decisions

- **Sí:** un solo spec (no dividirlo en dos), por decisión explícita del usuario, aunque toca base de datos y 5 pantallas a la vez.
- **Sí:** migrar el catálogo `GAMES` completo a una tabla de Supabase, en vez de dejarlo estático. Unifica el modelo de datos con el de `scores` y habilita un `best` real.
- **Sí:** `scores` como tabla real de Supabase, no `localStorage`. Da persistencia entre dispositivos y sesiones.
- **Sí:** identidad "nombre libre" sin autenticación real, igual que hoy. No existe todavía un spec de Auth.
- **Sí:** los 9 juegos leen su leaderboard de Supabase, con datos semilla para los 8 sin motor real, en vez de dejarlos con `seededScores` en el frontend. Un solo origen de datos para todos los leaderboards.
- **Sí:** `best` se calcula dinámicamente (`MAX(score)`) en vez de guardarse como columna fija. Refleja partidas reales.
- **No:** no se migran los puntajes ya guardados en `localStorage["av_scores"]` del navegador actual. Se arranca limpio con datos semilla; simplifica el spec.
- **No:** `plays` no se recalcula desde partidas reales, queda como mock migrado tal cual. Hoy no se trackea el inicio de una partida en ningún lado, solo el guardado del puntaje final; trackear eso es otro spec.
- **Sí:** fetch server-side (Server Component) + props a los Client Components existentes en las 4 pantallas que hoy son 100% cliente. Evita estados de carga adicionales y es consistente con cómo ya funciona `/game/[id]`.
- **Sí:** constraints básicos a nivel de base de datos (score positivo, nombre no vacío/acotado, FK a `games`) para el insert público sin auth. Mitiga basura obvia sin bloquear el flujo actual de nombre libre.
- **Sí:** `saveScore()` escribe solo en Supabase, ya no en `localStorage`. Consistente con "no migrar lo viejo" y con tener una sola fuente de verdad para los leaderboards.
- **Sí:** el botón "GUARDAR PUNTUACIÓN" se deshabilita/oculta para los 8 juegos sin motor real. Evita que cada click de demo inserte el mismo `DEMO_SCORE=15420` en la tabla real, contaminando su leaderboard.
- **Sí:** "TU MEJOR MARCA" en `/hall-of-fame` pasa a calcularse con datos reales (`getPlayerBest`, filtrado por nombre) en vez de la fórmula simulada actual.
- **Sí:** `getPlayerBest` se invoca desde el Client Component vía cliente **browser** de Supabase (no server), porque el nombre del usuario solo se conoce en el cliente (`localStorage["av_user"]`). Los demás fetches (catálogo, scores generales) usan el cliente **server**.
- **No:** no se aborda rate-limiting/anti-cheat sobre los inserts públicos de `scores` en este spec, más allá de los constraints de base de datos. Requeriría diseño propio (captcha, límites por IP, etc.) — fuera de alcance.

## Identified risks

- **Inserción pública sin auth.** Cualquiera con la clave pública (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) puede insertar puntajes falsos directamente en `scores`, sin pasar por la UI. Mitigación: los constraints básicos (score positivo, nombre acotado, FK a `games`) limitan el formato, pero no la cantidad; rate-limiting/anti-cheat queda explícitamente fuera de alcance de este spec.
- **Seed a medio terminar.** Si la migración de seed (paso 2) falla después de crear las tablas pero antes de poblarlas, el catálogo o los leaderboards podrían quedar vacíos y romper las 5 pantallas migradas después. Mitigación: verificar con `execute_sql`/`list_tables` que `games` y `scores` quedaron pobladas antes de tocar el frontend.
- **Build roto entre pasos intermedios.** Mientras `lib/data.ts` expone funciones viejas y nuevas a la vez (pasos 3 a 8), si se elimina `GAMES`/`seededScores` antes de migrar todas las pantallas que aún los usan, el build se rompe. Mitigación: seguir el orden del Implementation plan; no eliminar los exports viejos hasta el paso 9 (limpieza final).
- **Latencia de fetch server-side.** Al mover Home/Biblioteca/Play/Hall of Fame a Server Components con fetch a Supabase, cada navegación implica una consulta real a la DB en vez de leer un array en memoria; si Supabase responde lento, esas pantallas tardan más en renderizar que hoy. Mitigación: aceptado como parte de pasar a datos reales; no se agrega caching en este spec (`cacheComponents` no está habilitado en el proyecto).
- **Nombres duplicados sin auth.** Como la identidad es "nombre libre" sin cuenta, dos jugadores distintos con el mismo nombre se mezclan en el cálculo de "TU MEJOR MARCA" (mejor puntaje/rank). Mitigación: limitación conocida y aceptada al decidir "nombre libre, sin auth" — no es un bug de este spec, se resolvería con un spec de Auth futuro.

## What is **not** in this spec

- Autenticación real / login con Supabase Auth.
- Migración de los puntajes históricos de `localStorage["av_scores"]`.
- Motores de juego reales para los otros 8 juegos del catálogo.
- Recalcular `plays` a partir de partidas reales.
- Rate-limiting / anti-cheat sobre inserts públicos.
- Sonido/haptics, controles táctiles.
- Cambios visuales/CSS en las pantallas migradas.

Cada uno de estos, si se implementa, va en su propio spec.
