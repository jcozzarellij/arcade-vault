# SPEC 08 — Motor real de Arkanoid

> **Status:** aprobado
> **Depends on:** 05-asteroides-game-engine, 06-leaderboard-y-catalogo-supabase, 07-tetris-game-engine
> **Date:** 2026-08-17
> **Objective:** Portar el juego de Arkanoid de `references/started_games/04-arkanoid` (`game.js` + `levels.js`) a un motor real en TypeScript, jugable en `/game/arkanoid/play`, agregando una nueva fila `arkanoid` al catálogo Supabase y registrándolo en el `components/games/registry.ts` ya existente junto a `asteroids` y `tetris`.

## Scope

**In:**

- Nueva fila en la tabla `games` de Supabase (`INSERT`, vía `apply_migration`) con `id: "arkanoid"`: título, descripciones corta/larga, `cat: "ARCADE"`, `cover: "cover-arkanoid"` (nueva clase CSS pura), `color: "yellow"`, `plays: "0"`. La fila `bloque-buster` no se toca.
- Motor de juego portado desde `game.js` + `levels.js` a TypeScript en `lib/games/arkanoid/engine.ts`: paddle, pelota, grilla de bloques 10×6, los 5 niveles con sus patrones (plegados como constante privada del módulo), rebotes en paredes y paddle, colisión con bloques (uno por frame, como el original), puntaje +10/bloque, pérdida de vida al caer la pelota con reposicionamiento, avance automático de nivel al limpiar todos los bloques, multiplicador de velocidad por nivel (1.00→1.46) — sin dependencias de React ni del DOM, recibe `dt` e input, expone estado vía `getState()`.
- Sin sprites ni audio: paddle/pelota/bloques se dibujan con formas planas de canvas (`fillRect`/`arc`) en el color correspondiente, en vez de `drawImage` sobre el spritesheet. La animación de explosión al romper un bloque se conserva pero redibujada como un flash/partícula vectorial de ~150 ms (mismo `EXPLOSION_DURATION` del original) en vez de los 4 frames del spritesheet.
- Componente `components/games/ArkanoidCanvas.tsx`: mismo template que `AsteroidesCanvas.tsx`/`TetrisCanvas.tsx` (RAF loop, `KEY_MAP` con `ArrowLeft`/`ArrowRight`, DPR + `ResizeObserver`, refs para props, cleanup al desmontar).
- Registro de `arkanoid` en el `components/games/registry.ts` ya existente (creado en spec 07): `{ Canvas: ArkanoidCanvas, hasLives: true }`, sin `extraStat`.
- HUD: "Puntuación", "Vidas" y "Nivel" alimentados del motor real; sin quinto `hud-stat` para este juego.
- Botón PAUSA / RENDIRSE / modal de fin de partida / "JUGAR DE NUEVO" / "SALIR": mismo flujo ya existente en el shell, cableado a través del registry (igual que `asteroids`/`tetris`).
- Guardado de puntaje real vía `saveScore()` (Supabase `scores`), habilitado para `arkanoid` igual que para los otros dos juegos con motor real.
- Al limpiar el nivel 5 (completar el juego), el motor reporta `status: "gameover"` igual que al perder — el shell abre el mismo modal de fin con el puntaje real acumulado, sin un mensaje distinto de "victoria".

**Out of scope (para specs futuras):**

- Control del paddle por mouse (`mousemove`) — el juego queda solo con teclado (`←`/`→`), que ya existe como alternativa en la referencia.
- El overlay de pausa propio de la referencia con selector de nivel (click en 5 botones dentro del canvas) — redundante con el botón PAUSA del shell, se descarta igual que Tetris descartó `KeyP`.
- Sprites/PNG (`spritesheet-breakout.png`) y efectos de sonido (`ball-bounce.mp3`, `break-sound.mp3`) — la plataforma no sirve assets de imagen ni audio hoy.
- Un mensaje o estado visual distinto para "victoria" (limpiar los 5 niveles) frente a "game over" — usan el mismo modal.
- Controles táctiles/móviles.
- Actualizar dinámicamente `plays` de `arkanoid` a partir de partidas reales — queda como mock estático `"0"`.
- Cualquier retuning de dificultad respecto al original (velocidades, puntuación) — se porta tal cual.
- Repurposear/eliminar la fila `bloque-buster` — queda intacta.
- Motores de juego reales para los demás placeholders del catálogo (`caida` ya tiene motor vía `tetris`; `serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`, `rocas` quedan fuera).

## Data model

**Supabase — migración SQL** (aplicada vía `apply_migration` durante la implementación, no en este spec):

```sql
insert into games (id, title, short, long, cat, cover, color, plays)
values (
  'arkanoid', 'ARKANOID',
  'Paddle, pelota y bloques que estallan en cinco niveles cada vez más rápidos.',
  'El clásico rompebloques: controla el paddle con las flechas, rebota la pelota para destruir los bloques de cada nivel y avanza entre cinco patrones distintos mientras la velocidad de la pelota aumenta un 10% por nivel. Pierdes una vida si la pelota cae debajo del paddle.',
  'ARCADE', 'cover-arkanoid', 'yellow', '0'
);
```

**`lib/games/arkanoid/engine.ts`** — motor framework-agnostic, port desde `game.js` + `levels.js`:

```ts
export const WORLD_W = 800;
export const WORLD_H = 600;

export type ArkanoidInput = {
  left: boolean; // continuo, mientras se mantiene presionada la tecla
  right: boolean; // continuo, mientras se mantiene presionada la tecla
};

export type ArkanoidState = {
  status: "playing" | "gameover"; // "gameover" tanto al perder todas las vidas como al limpiar el nivel 5
  score: number;
  lives: number;
  level: number;
};

export class ArkanoidEngine {
  constructor();
  reset(): void; // equivalente a initPaddle() + loadLevel(1)
  update(dt: number, input: ArkanoidInput): void;
  draw(ctx: CanvasRenderingContext2D): void;
  getState(): ArkanoidState;
}
```

Constantes portadas 1:1 (privadas del módulo): `PADDLE_SPEED=400`, `BLOCK_COLS=10`, `BLOCK_ROWS=6`, `BLOCK_W=64`, `BLOCK_H=24`, `BLOCK_COLORS` (6, dibujados con `ctx.fillStyle` en vez de sprite), `BASE_BALL_VX=200`, `BASE_BALL_VY=-300`, paddle `81×14`, pelota `16×16` (dibujada como rect/círculo relleno), `EXPLOSION_DURATION=150` (duración del flash vectorial), 3 vidas iniciales, 10 pts/bloque. Los 5 niveles (`LEVELS`, con sus patrones de bloques y multiplicador `speed`) se pliegan como constante privada dentro de `engine.ts`, igual que `PIECES`/`COLORS` en `TetrisEngine` — no se crea un `levels.ts` separado.

**Discrepancias `CLAUDE.md` vs. código** (se confía en el código, ver Decisions): el campo de velocidad en `levels.js` se llama `speed`, no `ballSpeedMultiplier`; `paddle.w` es `81` en el objeto de juego (no `162`, que es el ancho nativo del sprite, escalado al dibujar); `currentLevel` es 1-indexado (`LEVELS[currentLevel - 1]`, arranca en `loadLevel(1)`), no 0-indexado; `gameState` en código es `'playing' | 'gameover' | 'win'`, sin incluir `'paused'` como miembro (se trackea aparte en `isPaused`).

**`components/games/ArkanoidCanvas.tsx`** — mismas props fijas que `AsteroidesCanvas`/`TetrisCanvas`:

```ts
type ArkanoidCanvasProps = {
  paused: boolean;
  onStateChange: (state: ArkanoidState) => void;
  onGameOver: (finalScore: number) => void;
  restartSignal: number;
};
```

`KEY_MAP`: `ArrowLeft→left`, `ArrowRight→right`. Ambos inputs son booleans continuos (no edge-triggered), igual que `thrust`/rotación en `asteroids` — el paddle se mueve mientras la tecla está presionada.

**`components/games/registry.ts`** — se agrega una entrada al mapa ya existente:

```ts
arkanoid: { Canvas: ArkanoidCanvas, hasLives: true },
```

Sin `extraStat`: no hay un quinto dato de HUD con valor claro más allá de Puntuación/Vidas/Nivel.

## Implementation plan

1. Crear `lib/games/arkanoid/engine.ts`: portar `game.js` + `levels.js` — `paddle`, `ball`, `blocks[]`, `explosions[]` (reescritas como partículas vectoriales), `lives`, `score`, `level`, colisiones con paredes/paddle/bloques, avance de nivel al limpiar bloques, mapeo de "victoria" (nivel 5 limpio) a `status: "gameover"` — encapsulado en `ArkanoidEngine` (`reset`/`update(dt, input)`/`draw(ctx)`/`getState`). `LEVELS` como constante privada plegada en el archivo. Dibujo 100% con formas de canvas (`fillRect`/`arc`), sin `drawImage`/spritesheet ni `Audio`. Sin `window`/`document`/`requestAnimationFrame` dentro del motor.
2. Crear `components/games/ArkanoidCanvas.tsx` copiando la estructura de `AsteroidesCanvas.tsx`/`TetrisCanvas.tsx`: `KEY_MAP` (`ArrowLeft`/`ArrowRight`), refs para `paused`/`onStateChange`/`onGameOver` (el efecto de montaje corre una sola vez), DPR + `ResizeObserver` con `ctx.setTransform` recalculado en cada resize, loop RAF con `dt` capado a 50ms, `onGameOver` latcheado a un solo disparo al ver `status === "gameover"` (sin importar si fue por derrota o por limpiar el nivel 5), `restartSignal` saltando su primera invocación, cleanup completo al desmontar.
3. Agregar la entrada `arkanoid` a `GAME_REGISTRY` en `components/games/registry.ts` (`Canvas: ArkanoidCanvas`, `hasLives: true`, sin `extraStat`). Verificar en `GamePlayerClient` que el HUD muestra Puntuación/Vidas/Nivel y que no aparece un quinto `hud-stat`.
4. Migración Supabase `insert_arkanoid_game`: `INSERT` de la fila `arkanoid` en `games` (Data model). Verificar con `execute_sql`/`list_tables` que quedó insertada y que `bloque-buster` no cambió.
5. Agregar la clase `.cover-arkanoid` (pure CSS, sin imágenes) en `app/globals.css`, junto a las demás `cover-*`, con una paleta distinguible de `cover-bricks` (usada por el placeholder `bloque-buster`).
6. QA manual: mover el paddle con `←`/`→` dentro de los límites, rebotar la pelota en paredes/paddle, romper bloques en el nivel 1 (ver flash de explosión ~150ms + puntaje +10 por bloque, un bloque por frame), limpiar el nivel para avanzar automáticamente hasta el nivel 5 notando el aumento de velocidad en cada uno, perder vidas hasta el game over con el modal real, limpiar el nivel 5 y verificar que abre el mismo modal de fin con el puntaje real, guardar puntuación, "JUGAR DE NUEVO", "RENDIRSE" a mitad de partida, PAUSA/REANUDAR congelando el juego, "SALIR" sin errores en consola; probar en al menos dos anchos de viewport; correr `npm run build` y `npm run lint` sin errores.

## Acceptance criteria

- [ ] `games` incluye la fila `id: "arkanoid"` con los campos definidos en Data model; `bloque-buster` y el resto del catálogo no cambian.
- [ ] `/game/arkanoid` (Detalle) muestra la info del juego y "JUGAR AHORA" navega a `/game/arkanoid/play`.
- [ ] `/game/arkanoid/play` renderiza el canvas real dentro de `.crt-screen`, escalado al contenedor sin deformar la proporción 4:3.
- [ ] El paddle se mueve con `←`/`→` dentro de los límites del canvas; no responde al mouse.
- [ ] La pelota rebota correctamente en las paredes izquierda/derecha/superior y en el paddle, con los mismos ángulos/velocidades del original.
- [ ] Romper un bloque suma exactamente 10 puntos, dispara un flash de explosión breve (~150ms) del color del bloque dibujado con formas vectoriales, y solo se rompe un bloque por frame.
- [ ] Si la pelota cae debajo del paddle, se resta una vida y la pelota/paddle se reposicionan (si quedan vidas).
- [ ] Limpiar todos los bloques de un nivel avanza automáticamente al siguiente (2 a 5), aumentando la velocidad de la pelota según el multiplicador original (×1.00 a ×1.46).
- [ ] Limpiar el nivel 5 dispara el mismo modal de fin de partida que perder, con el puntaje real acumulado, sin un mensaje distinto de "victoria".
- [ ] El HUD muestra Puntuación, Vidas y Nivel reales en cada frame; no aparece un quinto `hud-stat` para este juego.
- [ ] Al perder la última vida, se abre automáticamente el modal de fin de partida existente con el puntaje real.
- [ ] El botón "RENDIRSE" termina la partida manualmente en cualquier momento y abre el mismo modal con el puntaje acumulado hasta ese instante.
- [ ] Guardar puntuación en el modal escribe una fila real en `scores` (vía `saveScore`) y muestra "PUNTUACIÓN GUARDADA".
- [ ] "JUGAR DE NUEVO" reinicia el motor a un estado limpio (nivel 1, score 0, 3 vidas) sin recargar la página.
- [ ] PAUSA congela por completo el juego (paddle, pelota y bloques quedan quietos) y muestra el overlay "EN PAUSA"; REANUDAR continúa exactamente donde quedó.
- [ ] "SALIR" navega a `/game/arkanoid` sin errores en consola y sin que el loop siga corriendo en segundo plano.
- [ ] Al salir de `/game/arkanoid/play` y volver, el juego arranca limpio (sin estado ni listeners de teclado residuales).
- [ ] El resto del catálogo (incluido `bloque-buster`) conserva el shell visual estático/comportamiento sin cambios.
- [ ] `npm run build` y `npm run lint` terminan sin errores.

## Decisions

- **Sí:** agregar `arkanoid` como fila NUEVA en `games`, dejando `bloque-buster` intacto. Mismo criterio que `rocas`→`asteroids` y `caida`→`tetris`.
- **No:** repurposear `bloque-buster` en vez de insertar una fila nueva. Descartado por consistencia con el precedente de specs 05/07.
- **Sí:** redibujar paddle/pelota/bloques como formas planas de canvas (`fillRect`/`arc`) en vez de usar el spritesheet PNG de la referencia. La plataforma no sirve ningún asset de imagen hoy (specs 05/06/07), y `asteroids`/`tetris` ya son 100% vectoriales — consistencia visual del catálogo.
- **No:** portar `spritesheet.js` ni `spritesheet-breakout.png`. Fuera de alcance por la decisión anterior.
- **No:** portar los efectos de sonido (`ball-bounce.mp3`/`break-sound.mp3`). Sería el primer juego con audio de la plataforma; se decide explícitamente dejarlo fuera, consistente con specs 05/06/07.
- **Sí:** mantener la animación de explosión al romper un bloque, redibujada como un flash/partícula vectorial de ~150ms (mismo `EXPLOSION_DURATION` del original) en vez de los 4 frames de sprite. Es feedback visual real del juego, no decorativo — se preserva su timing aunque cambie su técnica de dibujo.
- **Sí:** controles solo por teclado (`←`/`→`), eliminando el control por mouse que es el primario en la referencia. El propio `game.js` ya soporta flechas como alternativa completa, no hace falta inventar un mapeo nuevo.
- **No:** portar el overlay de pausa con selector de nivel (click en 5 botones dentro del canvas). Redundante con el botón PAUSA/overlay ya existente del shell — mismo criterio que Tetris descartando `KeyP`.
- **Sí:** el estado de "victoria" (limpiar los 5 niveles) se mapea al mismo `status: "gameover"` que dispara el modal de fin del shell, mostrando el puntaje real sin un mensaje distinto de "ganaste". Encaja con el contrato existente sin tocar `GamePlayerClient` más allá de lo que ya hace por juego.
- **No:** agregar un tercer estado ("win") distinto en el shell. Se consideró pero se descarta para no ampliar el contrato del shell por un solo juego.
- **Sí:** plegar los 5 niveles (`LEVELS`, con sus patrones de bloques) como constante privada dentro de `engine.ts`, sin un `levels.ts` separado. Mismo criterio que `PIECES`/`COLORS` en `TetrisEngine` — el contrato solo exporta 5 símbolos desde `engine.ts`, el resto es privado del módulo.
- **Sí:** `ArkanoidInput` (`left`/`right`) son booleans continuos, no edge-triggered — coincide con cómo la referencia ya mueve el paddle (velocidad constante mientras la tecla está abajo) y con el patrón de `thrust`/rotación de `asteroids`.
- **Sí:** sin quinto `hud-stat` para `arkanoid` (`hasLives: true`, sin `extraStat`). No hay una mecánica adicional con valor claro de mostrar más allá de Puntuación/Vidas/Nivel.
- **Sí:** reutilizar el `components/games/registry.ts` ya existente (creado en spec 07) — `arkanoid` solo agrega una entrada nueva, sin refactor adicional al shell.
- **Sí:** nueva clase CSS `.cover-arkanoid` en vez de reutilizar `cover-bricks`. `cover-bricks` pertenece visualmente al placeholder `bloque-buster`, que sigue existiendo en el catálogo; reutilizar la misma portada para dos filas distintas confundiría al usuario en la biblioteca de juegos.
- **Sí:** `color: "yellow"` para la fila `arkanoid`. La diferencia de la de `bloque-buster` (cyan) dentro de `ARCADE`; `magenta` ya está tomado por `tetris` en el catálogo.
- **Sí:** trust del código (`game.js`/`levels.js`) por sobre el `CLAUDE.md` de la referencia en las 4 discrepancias detectadas (nombre del campo de velocidad, ancho del paddle, indexado de nivel, miembros de `gameState`). Regla explícita del contrato de integración.
- **No:** sonido, controles táctiles, retuning de dificultad, recalcular `plays` real. Fuera de alcance, consistente con specs 05/06/07.

## Identified risks

- **Doble loop por Strict Mode.** Igual que en `asteroids`/`tetris`: si el `useEffect` de `ArkanoidCanvas` no cancela el `requestAnimationFrame` y remueve listeners antes del segundo montaje de desarrollo, el juego correría el doble de rápido. Mitigación: mismo patrón de cleanup ya validado en los dos motores anteriores.
- **Fuga de listeners de teclado.** Si los listeners de `window` no se limpian al desmontar/navegar fuera de `/game/arkanoid/play`, las flechas seguirían interceptadas (con `preventDefault`) en otras pantallas. Mitigación: listeners scopeados al ciclo de vida del componente, igual que los otros dos juegos.
- **Túnel de la pelota a alta velocidad.** En el nivel 5 (×1.46), con un `dt` grande (tras un frame lento/tab-switch) la pelota podría atravesar un bloque completo sin colisionar, igual que en el original — no se corrige en este port, se hereda tal cual (el cap de `dt` a 50ms ya mitiga el peor caso).
- **`onGameOver` disparado por dos caminos distintos.** Como tanto perder todas las vidas como limpiar el nivel 5 llevan a `status: "gameover"`, el latch de un solo disparo en `ArkanoidCanvas` debe funcionar igual sin importar cuál de los dos caminos lo activó. Mitigación: reusar exactamente el mismo patrón de latch ya validado en `AsteroidesCanvas`/`TetrisCanvas`, sin lógica condicional adicional por causa.
- **Lectura visual sin sprites.** Bloques/paddle/pelota dibujados como formas planas podrían leerse más simples que el original con sprites reales. Mitigación: aceptado como parte de la decisión de "sin assets", consistente con el resto del catálogo (`asteroids`/`tetris` ya son vectoriales).

## What is **not** in this spec

- Control del paddle por mouse.
- Overlay de pausa con selector de nivel de la referencia.
- Sprites/PNG y efectos de sonido.
- Mensaje/estado distinto para "victoria" frente a "game over".
- Controles táctiles/móviles.
- Recalcular `plays` de `arkanoid` a partir de partidas reales.
- Retuning de dificultad respecto al original.
- Repurposear o eliminar la fila `bloque-buster`.
- Motores de juego reales para los demás placeholders del catálogo.

Cada uno de estos, si se implementa, va en su propio spec.
