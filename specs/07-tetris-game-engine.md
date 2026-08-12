# SPEC 07 — Motor real de Tetris

> **Status:** Aprobado
> **Depends on:** 05-asteroides-game-engine, 06-leaderboard-y-catalogo-supabase
> **Date:** 2026-08-11
> **Objective:** Portar el juego de Tetris de `references/started_games/03-tetris` (game.js) a un motor real en TypeScript, jugable en `/game/tetris/play`, agregando una nueva entrada "tetris" al catálogo Supabase e integrándolo con el shell de juego mediante un registry que reemplaza el flag hardcodeado `isAsteroides`.

## Scope

**In:**

- Nueva fila en la tabla `games` de Supabase (`INSERT`, vía `apply_migration`) con `id: "tetris"`: título, descripciones corta/larga, `cat: "PUZZLE"`, `cover: "cover-tetro"` (reutiliza clase CSS existente), `color: "magenta"`, `plays: "0"`. La fila `caida` no se toca.
- Extracción de `components/games/registry.ts`: mapa `id → { Canvas, hasLives, extraStat? }`. Refactor de `components/GamePlayerClient.tsx` para reemplazar el flag hardcodeado `isAsteroides` por un lookup `GAME_REGISTRY[game.id]` en las cinco ramas actuales (render del canvas, valores del HUD, quinto `hud-stat` condicional, label del botón RENDIRSE/FIN, rama de guardado de puntaje del modal). `asteroids` migra a este registry como parte del mismo refactor, sin cambiar su comportamiento.
- Motor de juego portado desde `game.js` a TypeScript en `lib/games/tetris/engine.ts`: tablero 10×20, las 8 piezas (7 estándar + la pieza custom "N"/tuerca), rotación con wall-kicks `[0,±1,±2]`, colisión, merge, limpieza de líneas, soft drop, hard drop con pieza fantasma, sistema de puntuación (`LINE_SCORES` × nivel, +1/fila soft drop, +2/celda hard drop), progresión de nivel/velocidad (`dropInterval = max(100, 1000-(level-1)*90)`, nivel = `floor(lines/10)+1`) — sin dependencias de React ni del DOM, recibe `dt` e input, expone estado vía `getState()`.
- Mundo lógico del motor redefinido a `WORLD_W=800`/`WORLD_H=600` (igual que `asteroids`, coincide con `.crt-screen` 4:3): el tablero se dibuja en la franja izquierda del canvas; la vista previa de la siguiente pieza ("NEXT"), que en la referencia usa un `<canvas>` separado, se dibuja dentro del mismo canvas en un panel a la derecha del tablero, como parte de `engine.draw()`.
- Componente `components/games/TetrisCanvas.tsx`: sigue el mismo template que `AsteroidesCanvas.tsx` (RAF loop, `KEY_MAP` con `ArrowLeft`/`ArrowRight`/`ArrowUp`/`ArrowDown`/`Space`, DPR + `ResizeObserver`, refs para props, cleanup al desmontar).
- HUD adaptado para `tetris`: "Puntuación" y "Nivel" alimentados del motor real; "Vidas" se **oculta** (el juego no tiene ese concepto, vía `hasLives: false` en el registry); el quinto `hud-stat` condicional muestra "Líneas" (líneas limpiadas).
- Botón PAUSA / RENDIRSE / modal de fin de partida / "JUGAR DE NUEVO" / "SALIR": mismo flujo ya existente en el shell, cableado a través del registry (igual que hoy para `asteroids`).
- Guardado de puntaje real vía `saveScore()` (Supabase `scores`), habilitado para `tetris` igual que para `asteroids`.

**Out of scope (para specs futuras):**

- Controles táctiles/móviles.
- Toggle de tema claro/oscuro de la referencia (no aplica al diseño fijo del Vault).
- Teclas redundantes de la referencia: `KeyX` (rotar alternativo) y `KeyP` (pausa por teclado) — la pausa se controla solo vía el botón PAUSA del shell.
- Actualizar dinámicamente `plays` de `tetris` a partir de partidas reales — queda como mock estático `"0"`.
- Sonido/haptics.
- Motores de juego reales para los otros 7 juegos del catálogo (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`) o para `rocas`.
- Cualquier retuning de dificultad respecto al original (velocidades, puntuación) — se porta tal cual.
- Repurposear/eliminar la fila `caida` — queda intacta.

## Data model

**Supabase — migración SQL** (aplicada vía `apply_migration` durante la implementación, no en este spec):

```sql
insert into games (id, title, short, long, cat, cover, color, plays)
values (
  'tetris', 'TETRIS',
  'Encaja las piezas, limpia líneas y sube de nivel antes de que el tablero se desborde.',
  'El Tetris clásico: siete piezas estándar más una pieza especial, caída suave y caída instantánea, pieza fantasma y vista previa de la siguiente pieza. Limpia líneas para sumar puntos y avanzar de nivel mientras la velocidad de caída aumenta.',
  'PUZZLE', 'cover-tetro', 'magenta', '0'
);
```

**`lib/games/tetris/engine.ts`** — motor framework-agnostic, port desde `game.js`:

```ts
export const WORLD_W = 800; // igual que asteroids, coincide con .crt-screen (4:3)
export const WORLD_H = 600;

export type TetrisInput = {
  left: boolean; // un paso por pulsación (edge-triggered)
  right: boolean; // un paso por pulsación (edge-triggered)
  softDrop: boolean; // un paso por pulsación (edge-triggered)
  rotate: boolean; // edge-triggered, con wall-kicks [0,±1,±2]
  hardDrop: boolean; // edge-triggered
};

export type TetrisState = {
  status: "playing" | "gameover"; // sin estado "dead": Tetris no tiene vidas/respawn
  score: number;
  level: number;
  lines: number; // líneas limpiadas acumuladas
};

export class TetrisEngine {
  constructor();
  reset(): void;
  update(dt: number, input: TetrisInput): void; // resuelve edge-trigger internamente con flags "prev*"
  draw(ctx: CanvasRenderingContext2D): void; // tablero + pieza fantasma + pieza actual + panel NEXT, todo en coords de mundo
  getState(): TetrisState;
}
```

Detalles de `draw()`: el tablero (10×20 celdas, `BLOCK=30`) ocupa la franja izquierda del canvas (`0,0` a `300,600` — coincide exacto con `WORLD_H`, sin reescalar el bloque). El panel derecho (`320,0` a `800,600` aprox.) dibuja la vista previa de la siguiente pieza ("NEXT"), reemplazando el `<canvas id="next-canvas">` separado de la referencia. `score`/`lines`/`level` **no** se dibujan en el canvas (se leen vía `getState()` y los muestra el HUD del shell, igual que en `asteroids`).

Constantes portadas 1:1 (privadas del módulo): `COLS=10`, `ROWS=20`, `BLOCK=30`, `COLORS` (8, incluida la pieza "N"/tuerca gris metálico), `PIECES` (8 formas), `LINE_SCORES=[0,100,300,500,800]`, `dropInterval = max(100, 1000-(level-1)*90)`, `level = floor(lines/10)+1`.

**`components/games/TetrisCanvas.tsx`** — mismas props fijas que `AsteroidesCanvas`:

```ts
type TetrisCanvasProps = {
  paused: boolean;
  onStateChange: (state: TetrisState) => void;
  onGameOver: (finalScore: number) => void;
  restartSignal: number;
};
```

`KEY_MAP`: `ArrowLeft→left`, `ArrowRight→right`, `ArrowDown→softDrop`, `ArrowUp→rotate`, `Space→hardDrop`. `KeyX` y `KeyP` de la referencia no se mapean (ver Scope).

**`components/games/registry.ts`** (nuevo):

```ts
export type GameEntry = {
  Canvas: React.ComponentType<GameCanvasProps>;
  hasLives: boolean;
  extraStat?: { label: string; select: (state: unknown) => string | null };
};

export const GAME_REGISTRY: Record<string, GameEntry> = {
  asteroids: {
    Canvas: AsteroidesCanvas,
    hasLives: true,
    extraStat: {
      label: "Disparo triple",
      select: (s) => {
        const st = s as AsteroidesState;
        return st.tripleShotRemaining > 0
          ? `${st.tripleShotRemaining.toFixed(1)}s`
          : null;
      },
    },
  },
  tetris: {
    Canvas: TetrisCanvas,
    hasLives: false,
    extraStat: {
      label: "Líneas",
      select: (s) => String((s as TetrisState).lines),
    },
  },
};
```

`GamePlayerClient.tsx` deja de usar el flag `isAsteroides === game.id === "asteroids"` y pasa a `const entry = GAME_REGISTRY[game.id]`; el `hud-stat` "Vidas" se renderiza solo si `entry.hasLives`; el quinto `hud-stat` se renderiza cuando `entry.extraStat?.select(engineState)` devuelve no-null. Juegos sin entrada en `GAME_REGISTRY` (los 7 placeholders restantes) siguen usando el shell decorativo estático, sin cambios.

Puntajes: `saveScore()` (sin cambios en `lib/session.ts`) se habilita para `tetris` igual que para `asteroids` — cualquier `id` presente en `GAME_REGISTRY` guarda puntaje real; los placeholders sin entrada siguen mostrando "ESTE JUEGO AÚN NO GUARDA PUNTUACIONES".

No hay discrepancias entre `CLAUDE.md` y `game.js` de la referencia — ambos coinciden, no se registra ninguna desviación.

## Implementation plan

1. Crear `components/games/registry.ts` con el shape `GameEntry`/`GAME_REGISTRY` (Data model), migrando `asteroids` a esta estructura. Refactorizar `GamePlayerClient.tsx` para reemplazar el flag hardcodeado `isAsteroides` por `GAME_REGISTRY[game.id]` en las cinco ramas actuales (canvas, valores del HUD, quinto `hud-stat`, label RENDIRSE/FIN, rama de guardado del modal). Verificar que `asteroids` sigue funcionando exactamente igual (`npm run build` + partida rápida) antes de seguir — este paso no debe cambiar comportamiento observable.
2. Crear `lib/games/tetris/engine.ts`: portar `game.js` — tablero 10×20, las 8 piezas (7 estándar + "N"/tuerca), `rotateCW`+wall-kicks, `collide`, `merge`, `clearLines`, soft drop, hard drop con pieza fantasma, scoring (`LINE_SCORES`×nivel, +1/fila, +2/celda), progresión de nivel/velocidad — encapsulado en `TetrisEngine` (`reset`/`update(dt, input)`/`draw(ctx)`/`getState`). Mundo lógico `WORLD_W=800`/`WORLD_H=600`: tablero en la franja izquierda (`BLOCK=30` sin reescalar), panel de vista previa ("NEXT") a la derecha, dibujados ambos dentro de `draw()`. Los cinco campos de `TetrisInput` se resuelven edge-triggered con flags `prev*` privados, sin `window`/`document`/`requestAnimationFrame` dentro del motor.
3. Crear `components/games/TetrisCanvas.tsx` copiando la estructura de `AsteroidesCanvas.tsx`: `KEY_MAP` (`ArrowLeft/Right/Down/Up`, `Space`), refs para `paused`/`onStateChange`/`onGameOver` (el efecto de montaje corre una sola vez), DPR + `ResizeObserver` con `ctx.setTransform` recalculado en cada resize, loop RAF con `dt` capado a 50ms, `onGameOver` latcheado a un solo disparo al ver `status === "gameover"`, `restartSignal` saltando su primera invocación, cleanup completo (RAF, listeners, `ResizeObserver.disconnect()`) al desmontar.
4. Agregar la entrada `tetris` a `GAME_REGISTRY` (`Canvas: TetrisCanvas`, `hasLives: false`, `extraStat` "Líneas"). Verificar en `GamePlayerClient` que el `hud-stat` "Vidas" desaparece para `tetris` y que "Líneas" se muestra siempre (no es condicional a un power-up, a diferencia del disparo triple de `asteroids`).
5. Migración Supabase `insert_tetris_game`: `INSERT` de la fila `tetris` en `games` (Data model). Verificar con `execute_sql`/`list_tables` que quedó insertada y que la fila `caida` no cambió.
6. Sin paso de CSS nuevo: se reutiliza `cover-tetro`, ya existente en `app/globals.css`.
7. QA manual: jugar una partida completa (mover, rotar con wall-kick contra la pared, soft drop, hard drop, ver la pieza fantasma, limpiar 1/2/3/4 líneas y verificar puntaje según `LINE_SCORES`×nivel, subir de nivel cada 10 líneas y notar el aumento de velocidad, generar la pieza "N", perder por apilamiento hasta el tope y ver el modal de fin con el puntaje real, guardar puntuación, "JUGAR DE NUEVO", "RENDIRSE" a mitad de partida, PAUSA/REANUDAR congelando el juego, "SALIR" sin errores); repetir el mismo QA rápido para `asteroids` para confirmar que el refactor del registry no rompió nada; probar en al menos dos anchos de viewport; correr `npm run build` y `npm run lint` sin errores.

## Acceptance criteria

- [ ] `games` incluye la fila `id: "tetris"` con los campos definidos en Data model; la fila `caida` y el resto del catálogo no cambian.
- [ ] `/game/tetris` (Detalle) muestra la info del juego y "JUGAR AHORA" navega a `/game/tetris/play`.
- [ ] `/game/tetris/play` renderiza el canvas real dentro de `.crt-screen`, con el tablero y el panel "NEXT" visibles sin deformarse, mundo 800×600 escalado correctamente al contenedor.
- [ ] Las piezas se mueven con `←`/`→`, rotan en sentido horario con `↑` (con wall-kick cuando están pegadas al borde), bajan más rápido con `↓` y caen instantáneamente con `Espacio`; cada input mueve/rota/baja un paso por pulsación (sin repetición continua al mantener presionado).
- [ ] La pieza fantasma se dibuja en la posición de aterrizaje proyectada, con transparencia, sin bloquear el movimiento de la pieza activa.
- [ ] El panel "NEXT" muestra correctamente la siguiente pieza (incluida la pieza "N"/tuerca cuando sale sorteada) y se actualiza al fijarse la pieza actual.
- [ ] Limpiar 1/2/3/4 líneas simultáneas suma exactamente `[100,300,500,800]` × nivel actual al puntaje; el hard drop suma 2 puntos por celda recorrida y el soft drop 1 punto por fila bajada.
- [ ] El nivel sube cada 10 líneas limpiadas (`floor(lines/10)+1`) y la velocidad de caída aumenta según `max(100, 1000-(level-1)*90)` ms.
- [ ] El HUD muestra Puntuación y Nivel reales en cada frame; el `hud-stat` "Vidas" **no se muestra** para `tetris`; el quinto `hud-stat` muestra "Líneas" con el conteo real, siempre visible mientras se juega.
- [ ] Cuando una pieza nueva colisiona al aparecer (tablero desbordado), se abre automáticamente el modal de fin de partida existente con el puntaje real acumulado.
- [ ] El botón "RENDIRSE" termina la partida manualmente en cualquier momento y abre el mismo modal con el puntaje acumulado hasta ese instante.
- [ ] Guardar puntuación en el modal escribe una fila real en `scores` (vía `saveScore`) y muestra "PUNTUACIÓN GUARDADA".
- [ ] "JUGAR DE NUEVO" reinicia el motor a un estado limpio (tablero vacío, score 0, líneas 0, nivel 1) sin recargar la página.
- [ ] PAUSA congela por completo el juego (ninguna pieza se mueve ni cae) y muestra el overlay "EN PAUSA"; REANUDAR continúa exactamente donde quedó.
- [ ] "SALIR" navega a `/game/tetris` sin errores en consola y sin que el loop siga corriendo en segundo plano.
- [ ] Al salir de `/game/tetris/play` y volver, el juego arranca limpio (sin estado ni listeners de teclado residuales).
- [ ] Tras el refactor a `components/games/registry.ts`, `asteroids` conserva exactamente el mismo comportamiento que antes (canvas, HUD, disparo triple, RENDIRSE, guardado de puntaje) — verificado con una partida de QA.
- [ ] El resto del catálogo (7 placeholders restantes, incluido `caida`) conserva el shell visual estático sin cambios de comportamiento.
- [ ] `npm run build` y `npm run lint` terminan sin errores.

## Decisions

- **Sí:** agregar `tetris` como fila NUEVA en `games`, dejando `caida` intacta. `caida` es un placeholder distinto sin motor; `tetris` es el juego que se implementa en este spec — mismo criterio que `rocas`→`asteroids`.
- **No:** repurposear `caida` en vez de insertar una fila nueva. Descartado por consistencia con el precedente de spec 05.
- **Sí:** redefinir el mundo lógico del motor a `800×600` (en vez de los `300×600` originales), dibujando el tablero en la franja izquierda y el panel "NEXT" en la derecha, ambos dentro del mismo canvas. Evita letterbox con franjas negras enormes (el tablero original es 1:2, muy lejos de 4:3) y reutiliza exactamente el mismo mundo que `asteroids`, ya ajustado a `.crt-screen`.
- **Sí:** portar la vista previa de la siguiente pieza ("NEXT") dibujándola dentro del canvas principal, en vez de descartarla. Es una mecánica real de Tetris con valor de juego, no un elemento decorativo de la referencia.
- **Sí:** portar la pieza custom "N" (tuerca) tal cual, sin recortar a las 7 piezas estándar. Está en el código fuente que se pidió portar; recortarla sería una decisión de diseño no pedida.
- **Sí:** todos los inputs (`left`, `right`, `softDrop`, `rotate`, `hardDrop`) son edge-triggered (un paso por pulsación), en vez de repetición continua mientras se mantiene presionada la tecla. El original dependía del key-repeat nativo del navegador (sin DAS propio); replicar exactamente ese timing agregaría constantes de tuning que no existen en `game.js`. Decisión explícita del usuario.
- **No:** implementar DAS (delayed auto-shift) con timing propio. Se consideró como alternativa más fiel a la sensación del original, pero se descartó por introducir tuning nuevo fuera del alcance de un port 1:1.
- **No:** mapear `KeyX` (rotar alternativo) ni `KeyP` (pausa por teclado) de la referencia. `KeyP` es redundante con el botón PAUSA del shell (que ya controla el estado `paused` vía prop, igual que en `asteroids`); `KeyX` es un atajo redundante de `ArrowUp`.
- **No:** portar el toggle de tema claro/oscuro de la referencia. No encaja con el diseño visual fijo (CRT) del Vault; es una feature de la página standalone de referencia, no del juego en sí.
- **Sí:** Tetris no tiene concepto de vidas — `TetrisState.status` es `"playing" | "gameover"` (sin el estado intermedio `"dead"` que sí tiene `asteroids` por su respawn con invencibilidad). El `hud-stat` "Vidas" se oculta para este juego vía `hasLives: false` en el registry.
- **Sí:** el quinto `hud-stat` condicional muestra "Líneas", siempre visible mientras se juega (a diferencia del "Disparo triple" de `asteroids`, que solo aparece mientras el power-up está activo). Es el stat más natural y siempre relevante para Tetris.
- **Sí:** adoptar ahora el refactor a `components/games/registry.ts`, migrando también `asteroids` a la misma estructura. Es el segundo juego real del catálogo — seguir agregando ramas `=== "id"` a mano en `GamePlayerClient.tsx` escala mal desde el segundo juego en adelante.
- **Sí:** reutilizar la clase CSS `cover-tetro` ya existente en `app/globals.css`, en vez de escribir una nueva. Ya está pensada visualmente para esto (gradiente morado) y no se usa en ningún otro juego del catálogo.
- **Sí:** HUD/game-over/pausa siguen renderizados por el shell (no dibujados dentro del canvas), igual que en `asteroids` — consistencia de plataforma, decisión ya tomada en spec 05.
- **No:** sonido, controles táctiles, retuning de dificultad, recalcular `plays` real. Fuera de alcance, consistente con specs 05/06.

## Identified risks

- **Doble loop por Strict Mode.** Igual que en `asteroids`: si el `useEffect` de `TetrisCanvas` no cancela el `requestAnimationFrame` y remueve listeners antes del segundo montaje de desarrollo, el juego correría el doble de rápido. Mitigación: mismo patrón de cleanup ya validado en `AsteroidesCanvas.tsx`.
- **Fuga de listeners de teclado.** Si los listeners de `window` no se limpian al desmontar/navegar fuera de `/game/tetris/play`, las flechas y espacio seguirían interceptadas (con `preventDefault`) en otras pantallas. Mitigación: listeners scopeados al ciclo de vida del componente, igual que `asteroids`.
- **Inputs edge-triggered mal implementados.** Si el flag `prev*` de alguno de los cinco inputs (`left`/`right`/`softDrop`/`rotate`/`hardDrop`) no se resetea correctamente entre frames, una sola pulsación podría disparar múltiples movimientos/rotaciones (flag nunca se pone en `true`→`false`) o ninguno (flag atascado en `true`). Mitigación: cada input sigue el mismo patrón exacto ya usado para `shoot` en `AsteroidesEngine`, con test manual de "una pulsación = un paso" para los cinco.
- **Regresión en `asteroids` por el refactor del registry.** Migrar `GamePlayerClient.tsx` del flag `isAsteroides` a `GAME_REGISTRY[game.id]` toca las cinco ramas que hoy funcionan en producción para `asteroids`; un error en el refactor podría romper su HUD, guardado de puntaje o el disparo triple. Mitigación: el paso 1 del plan de implementación aísla el refactor antes de tocar Tetris, con verificación explícita (`npm run build` + partida rápida de `asteroids`) antes de continuar.
- **Geometría del panel NEXT dentro del canvas ampliado.** Al pasar de un `<canvas>` de tablero dedicado (300×600) a un mundo compartido de 800×600 con tablero + panel, un error en el offset de dibujo podría solapar el panel "NEXT" con el tablero o dejarlo fuera del área visible en resoluciones angostas. Mitigación: coordenadas de mundo fijas (`WORLD_W`/`WORLD_H` no cambian con el tamaño real de pantalla), el `ResizeObserver` solo reescala la transformación pixel↔mundo, nunca el layout interno del `draw()`.
- **Colisión de la pieza "N" (tuerca) contra `collide`/`tryRotate`.** Es una forma 3×3 no estándar (no está en ningún set clásico de Tetris); si el wall-kick `[0,±1,±2]` no se comporta igual que con las piezas estándar, podría atascarse contra los bordes de forma distinta al resto. Mitigación: el criterio de aceptación de QA incluye explícitamente generar y rotar esta pieza cerca de los bordes.

## What is **not** in this spec

- Controles táctiles/móviles.
- Toggle de tema claro/oscuro.
- Teclas redundantes `KeyX` y `KeyP` de la referencia.
- Recalcular `plays` de `tetris` a partir de partidas reales.
- Sonido/haptics.
- Motores de juego reales para los otros 7 juegos del catálogo o para `rocas`.
- Retuning de dificultad respecto al original.
- Repurposear o eliminar la fila `caida`.

Cada uno de estos, si se implementa, va en su propio spec.
