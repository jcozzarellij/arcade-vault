# SPEC 05 — Motor real de Asteroides

> **Status:** aprobado
> **Depends on:** 01-mvp-visual-screens
> **Date:** 2026-07-30
> **Objective:** Portar el juego de asteroides de `references/started_games/02-asteroids` (game.js) a un motor real en TypeScript, jugable en `/game/asteroids/play`, agregando una nueva entrada "asteroids" al catálogo `GAMES` e integrándolo con el HUD y el modal de fin de partida ya existentes en el shell de juego.

## Scope

**In:**

- Nueva entrada en `GAMES` (`lib/data.ts`) con `id: "asteroids"`: título, descripción corta/larga, `cat: "SHOOTER"`, reutilizando la clase de portada CSS `cover-rocas` (mismo estilo visual de campo de asteroides), color y valores `best`/`plays` mock estáticos siguiendo el mismo patrón que el resto del catálogo. `"rocas"` no se modifica ni se elimina.
- Motor de juego portado 1:1 desde `game.js` a TypeScript en `lib/games/asteroides/engine.ts`: clases `Ship`, `Asteroid`, `Bullet`, `Particle`, `PowerUp`, constantes (`RADII`, `SPEEDS`, `POINTS`, `POWERUP_*`, `TRIPLE_SPREAD`), física, wrapping toroidal, spawn de asteroides, splits, colisiones, niveles, disparo triple con power-up — sin dependencias de React ni del DOM directamente (recibe `dt` y un contexto de canvas para dibujar, expone su estado mediante getters).
- Componente `components/games/AsteroidesCanvas.tsx`: monta el `<canvas>`, corre el loop vía `requestAnimationFrame`, escucha teclado (flechas + espacio) solo mientras está montado (con `preventDefault` en esas teclas y cleanup al desmontar), traduce el estado del motor (score, vidas, nivel, power-up activo y su tiempo restante, game over) a estado de React mediante callbacks/props.
- Canvas responsive: coordenadas de mundo lógicas fijas en 800×600 (idénticas al original), renderizado escalado al tamaño real de `.crt-screen` (que ya es `aspect-ratio: 4/3`) usando `devicePixelRatio` para nitidez, sin cambiar la física ni el gameplay.
- Reemplazo del contenido estático de `.game-arena` (`grid-floor`, `.enemy`, `.player-ship`) por `<AsteroidesCanvas />` **solo cuando `game.id === "asteroids"`** en `app/game/[id]/play/page.tsx`; el resto de juegos (`rocas` y los demás 7) conservan el shell visual estático sin cambios.
- HUD adaptado para `asteroids`: los valores de "Puntuación", "Vidas" y "Nivel" del HUD de React existente pasan a alimentarse del estado real del motor (ya no de `DEMO_SCORE`/`DEMO_LIVES`/`DEMO_LEVEL` para este juego); se agrega un quinto `hud-stat` condicional ("Disparo triple: N.Ns") visible solo mientras el power-up está activo.
- Botón **PAUSA**: congela el loop del motor (no avanza física ni procesa disparo/rotación mientras está en pausa) y muestra el overlay "EN PAUSA" ya existente.
- Botón **FIN** repurposeado como "rendirse": termina la partida en curso manualmente, abriendo el modal de fin existente con el puntaje real acumulado hasta ese momento.
- Game over automático: al perder la última vida, se abre el modal de fin de partida existente con el puntaje real (ya no `DEMO_SCORE`), reutilizando el flujo de guardado (`saveScore`) sin cambios en `lib/session.ts`.
- Botón "JUGAR DE NUEVO" del modal: reinicia el estado interno del motor (equivalente a `initGame()`) en vez de solo cerrar el modal.
- Botón "SALIR": detiene el loop y limpia listeners de teclado al desmontar/navegar (cleanup del `useEffect`), sin cambios de comportamiento en la navegación.

**Out of scope (para specs futuras):**

- Controles táctiles/móviles — el juego queda solo con teclado en este spec.
- Actualizar dinámicamente `best`/`plays` de la entrada `asteroids` en `lib/data.ts` a partir de partidas reales — quedan como mock estático, igual que el resto del catálogo.
- Conectar el leaderboard de `/game/asteroids` y `/hall-of-fame` a los puntajes reales guardados en `localStorage["av_scores"]` — ambos siguen usando `seededScores` (mock), sin cambios.
- Guardar puntajes o el catálogo de juegos en Supabase — sin migración de puntajes por ahora, y migrar `GAMES` a Supabase tocaría las 5 pantallas que hoy lo leen de forma síncrona desde `lib/data.ts`; queda para un spec futuro si se retoma.
- Sonido/haptics.
- Cualquier motor de juego real para los otros 7 juegos del catálogo (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`) o para `rocas` — cada uno amerita su propio spec.
- Abstraer una interfaz/base compartida entre motores de juego (`GameEngine` genérico, registry, etc.) — este spec solo establece la convención de carpetas (`lib/games/<id>/`, `components/games/<Id>Canvas.tsx`), no una abstracción de código compartida.
- Dificultad/tuning distinto al original (velocidades, spawn rate, puntos) — se porta tal cual.

## Data model

**`lib/data.ts`** — nueva entrada en `GAMES` (misma interfaz `Game` existente, sin cambios de forma):

```ts
{
  id: "asteroids",
  title: "ASTEROIDES",
  short: "Nave, gravedad cero y rocas que se parten en pedazos.",
  long: "Pilota una nave triangular en un campo toroidal de asteroides. Dispara para partir rocas grandes en fragmentos cada vez más pequeños, recoge el power-up de disparo triple y sobrevive con tus 3 vidas mientras el nivel escala.",
  cat: "SHOOTER",
  cover: "cover-rocas",
  color: "cyan",
  best: 38900,
  plays: "0",
}
```

**`lib/games/asteroides/engine.ts`** — motor framework-agnostic, port 1:1 de `game.js`:

```ts
export const WORLD_W = 800;
export const WORLD_H = 600;

export class Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  radius: number;
  dead: boolean; /* update(dt), draw(ctx) */
}
export class Asteroid {
  x: number;
  y: number;
  size: 1 | 2 | 3;
  radius: number;
  verts: [number, number][];
  dead: boolean; /* update(dt), split(), draw(ctx) */
}
export class PowerUp {
  x: number;
  y: number;
  radius: number;
  ttl: number;
  dead: boolean; /* update(dt), draw(ctx) */
}
export class Ship {
  x: number;
  y: number;
  angle: number;
  tripleShot: number;
  invincible: number;
  dead: boolean; /* reset(), update(dt, input), tryShoot(), draw(ctx) */
}
export class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  life: number;
  dead: boolean; /* update(dt), draw(ctx) */
}

export type AsteroidesInput = {
  left: boolean;
  right: boolean;
  thrust: boolean;
  shoot: boolean;
};

export type AsteroidesState = {
  status: "playing" | "dead" | "gameover";
  score: number;
  lives: number;
  level: number;
  tripleShotRemaining: number; // 0 si no hay power-up activo
};

export class AsteroidesEngine {
  constructor();
  reset(): void; // equivalente a initGame()
  update(dt: number, input: AsteroidesInput): void;
  draw(ctx: CanvasRenderingContext2D): void;
  getState(): AsteroidesState;
}
```

**`components/games/AsteroidesCanvas.tsx`** — props de integración con el shell existente:

```ts
type AsteroidesCanvasProps = {
  paused: boolean;
  onStateChange: (state: AsteroidesState) => void; // se llama en cada frame con el estado actual
  onGameOver: (finalScore: number) => void; // se llama una vez, al perder la última vida
  restartSignal: number; // incrementar desde el padre dispara reset()
};
```

Puntajes: se mantiene el flujo existente `saveScore()` de `lib/session.ts` hacia `localStorage["av_scores"]`, sin cambios ni migración a Supabase (fuera de alcance de este spec).

`app/game/[id]/play/page.tsx` deja de usar `DEMO_SCORE`/`DEMO_LIVES`/`DEMO_LEVEL` **solo cuando `game.id === "asteroids"`**; para el resto de juegos esas constantes de ejemplo no cambian.

## Implementation plan

1. Agregar la entrada `asteroids` a `GAMES` en `lib/data.ts` (según el Data model de arriba), sin tocar las demás entradas.
2. Crear `lib/games/asteroides/engine.ts`: portar `game.js` a TypeScript — clases `Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle`, constantes (`RADII`, `SPEEDS`, `POINTS`, `POWERUP_DROP_CHANCE`, `POWERUP_DURATION`, `POWERUP_TTL`, `TRIPLE_SPREAD`), funciones utilitarias (`wrap`, `dist`, `rand`, `randInt`) y la clase `AsteroidesEngine` que encapsula el estado global del original (`ship`, `bullets`, `asteroids`, `particles`, `powerUps`, `score`, `lives`, `level`, `state`, `deadTimer`, `powerUpSpawned`, `killsSinceSpawn`) detrás de `reset()`, `update(dt, input)`, `draw(ctx)` y `getState()`. Sin `window`/`document`/`requestAnimationFrame` dentro del motor — solo recibe `dt` e input, y un `CanvasRenderingContext2D` para dibujar.
3. Crear `components/games/AsteroidesCanvas.tsx`: monta un `<canvas>` con `ref`, en un `useEffect` instancia `AsteroidesEngine`, agrega listeners de `keydown`/`keyup` en `window` (con `preventDefault` para `ArrowLeft`/`ArrowRight`/`ArrowUp`/`Space`) que alimentan el objeto `input`, corre el loop con `requestAnimationFrame` (dt capado a 50ms, dt=0 mientras `paused` es `true`), redimensiona el canvas al tamaño real de su contenedor (`ResizeObserver` o el tamaño en el montaje) escalando por `devicePixelRatio` mientras el mundo lógico sigue en 800×600, llama a `onStateChange` con `engine.getState()` en cada frame, llama a `onGameOver(score)` una sola vez cuando `status` pasa a `"gameover"`, resetea el motor cuando `restartSignal` cambia, y limpia listeners + cancela el RAF al desmontar.
4. Modificar `app/game/[id]/play/page.tsx`: cuando `game.id === "asteroids"`, renderizar `<AsteroidesCanvas />` dentro de `.game-arena` en vez de los divs decorativos (`grid-floor`/`enemy`/`player-ship`); mantener el shell decorativo sin cambios para el resto de juegos. Conectar el HUD (`Puntuación`, `Vidas`, `Nivel`) y el nuevo `hud-stat` condicional de disparo triple al estado recibido por `onStateChange`. Cablear `paused` al botón PAUSA existente. Cablear `onGameOver` para abrir el modal de fin con el puntaje real. Repurposear el botón FIN como "RENDIRSE" para `asteroids` (llama al mismo flujo de fin de partida con el puntaje acumulado actual, sin esperar a perder todas las vidas). Cablear "JUGAR DE NUEVO" para incrementar `restartSignal` en vez de solo cerrar el modal.
5. Verificar que `app/game/[id]/page.tsx` (Detalle) y `/hall-of-fame` funcionan sin cambios para `asteroids` (ya iteran genéricamente sobre `GAMES`), y que el botón "JUGAR AHORA" navega a `/game/asteroids/play` normalmente.
6. QA manual: jugar una partida completa (rotar, propulsar, disparar, romper asteroides grandes → medianos → pequeños, recoger power-up y ver expirar el disparo triple, pasar de nivel, perder las 3 vidas y ver el modal de fin con el puntaje real, guardar puntuación, "JUGAR DE NUEVO", "RENDIRSE" a mitad de partida, PAUSA/REANUDAR congelando el juego, "SALIR" sin errores en consola); probar en al menos dos anchos de viewport para confirmar que el canvas escala dentro de `.crt-screen` sin deformarse; correr `npm run build` y `npm run lint` sin errores.

## Acceptance criteria

- [ ] `GAMES` en `lib/data.ts` incluye la entrada `id: "asteroids"` con los campos definidos en Data model; `rocas` y el resto del catálogo no cambian.
- [ ] `/game/asteroids` (Detalle) muestra la info del juego y el botón "JUGAR AHORA" navega a `/game/asteroids/play`.
- [ ] `/game/asteroids/play` renderiza el canvas real del juego dentro de `.crt-screen`, escalado al tamaño del contenedor sin deformar la proporción 4:3.
- [ ] La nave rota con flechas izquierda/derecha, propulsa con flecha arriba y dispara con espacio; las balas y asteroides envuelven los bordes del canvas (wrapping toroidal).
- [ ] Los asteroides grandes se destruyen y parten en medianos, los medianos en pequeños, y los pequeños desaparecen sin dividirse; el puntaje del HUD aumenta según el tamaño destruido (20/50/100 como en el original).
- [ ] Al recoger el power-up, la nave dispara en triple ráfaga y el HUD muestra el quinto `hud-stat` "Disparo triple" con cuenta regresiva mientras está activo; desaparece al expirar.
- [ ] El HUD (Puntuación, Vidas, Nivel) refleja el estado real del motor en cada frame, no valores fijos de ejemplo.
- [ ] Al perder una vida sin ser la última, la nave reaparece con parpadeo de invencibilidad temporal, igual que el original.
- [ ] Al perder la última vida, se abre automáticamente el modal de fin de partida existente con el puntaje real acumulado.
- [ ] El botón "RENDIRSE" (antes "FIN") termina la partida manualmente en cualquier momento y abre el mismo modal con el puntaje acumulado hasta ese instante.
- [ ] Guardar puntuación en el modal escribe una entrada real en `localStorage["av_scores"]` (vía `saveScore`, sin cambios en `lib/session.ts`) y muestra "PUNTUACIÓN GUARDADA".
- [ ] "JUGAR DE NUEVO" reinicia el motor a un estado limpio (score 0, 3 vidas, nivel 1) sin recargar la página.
- [ ] El botón PAUSA congela por completo el juego (nave, asteroides, balas y power-ups quedan quietos, no se procesan disparo ni rotación) y muestra el overlay "EN PAUSA"; "REANUDAR" continúa exactamente donde quedó.
- [ ] "SALIR" navega a `/game/asteroids` sin errores en consola y sin que el loop del juego siga corriendo en segundo plano.
- [ ] Al pasar de `/game/asteroids/play` a cualquier otra ruta y volver, el juego arranca limpio (sin estado ni listeners de teclado residuales de la visita anterior).
- [ ] El resto de los 8 juegos del catálogo (incluido `rocas`) conserva el shell visual estático sin cambios de comportamiento.
- [ ] `npm run build` y `npm run lint` terminan sin errores.

## Decisions

- **Sí:** agregar `asteroids` como entrada NUEVA en `GAMES`, dejando `rocas` intacto. `rocas` es un juego distinto en el catálogo (placeholder sin motor aún); `asteroids` es el que se implementa en este spec.
- **No:** renombrar/reemplazar `rocas` por `asteroids`. Descartado por decisión explícita del usuario — son juegos separados.
- **Sí:** adaptar el motor al HUD y modal de fin de partida ya existentes en el shell (`app/game/[id]/play/page.tsx`), en vez de mantener el HUD/game-over dibujados dentro del canvas como en el original. Consistencia con el resto de la plataforma; el shell ya fue diseñado en el spec 01 para ser genérico.
- **Sí:** portar la mecánica de power-up (disparo triple) presente en `game.js`, aunque no esté documentada en el README del juego de referencia. Es parte del archivo fuente que se pidió adaptar.
- **Sí:** repurposear el botón "FIN" como "RENDIRSE" en vez de eliminarlo. Da al jugador una forma de terminar la partida manualmente sin perder las 3 vidas.
- **Sí:** botón PAUSA congela el loop del motor (dt=0 / se salta `update`) en vez de cancelar el `requestAnimationFrame`. Más simple de razonar (el RAF sigue vivo, solo el motor no avanza) y evita tener que re-registrar el RAF al reanudar.
- **Sí:** canvas responsive dentro de `.crt-screen` (que ya es `aspect-ratio: 4/3`), escalado por `devicePixelRatio`, manteniendo el mundo lógico fijo en 800×600. Evita que el juego se vea recortado o diminuto según el tamaño de pantalla, sin tocar la física original.
- **No:** controles táctiles/móviles en este spec. Fuera de alcance, el juego queda solo con teclado por ahora.
- **Sí:** arquitectura `lib/games/<id>/engine.ts` (motor framework-agnostic) + `components/games/<Id>Canvas.tsx` (wrapper de React). Separa lógica de juego de React y sienta un patrón repetible para los próximos motores de juego, sin construir todavía ninguna abstracción compartida entre ellos (eso se evaluará cuando exista un segundo juego real).
- **No:** guardar puntajes ni el catálogo de juegos en Supabase en este spec. Se consideró durante la definición, pero el usuario decidió explícitamente dejarlo fuera — no hay migración de puntajes todavía, y migrar el catálogo (`GAMES`) a Supabase toca las 5 pantallas que hoy lo leen de forma síncrona desde `lib/data.ts`, lo cual amerita su propio spec futuro si se retoma.
- **Sí:** mantener `saveScore()` / `localStorage["av_scores"]` sin cambios como único mecanismo de persistencia de puntajes para este spec.
- **Sí:** `best`/`plays` de la entrada `asteroids` quedan como valores mock estáticos, igual que el resto del catálogo — no se recalculan a partir de partidas reales.
- **Sí (durante implementación):** el `id` del catálogo se llama `asteroids` (inglés), no `asteroides`, dejando la ruta como `/game/asteroids/play`. Se mantiene el prefijo `/game/` singular (igual que los otros 8 juegos) — no se renombra a `/games/`, eso hubiera afectado a todo el catálogo y quedó fuera de alcance. El `title` visible sigue en español ("ASTEROIDES"); solo el id/slug cambia. La carpeta interna `lib/games/asteroides/` y el componente `AsteroidesCanvas` no se renombran, ya que son implementación interna sin impacto en la URL.

## Identified risks

- **Doble loop por Strict Mode.** En desarrollo, React monta/desmonta effects dos veces; si el `useEffect` de `AsteroidesCanvas` no cancela correctamente el `requestAnimationFrame` y remueve los listeners de teclado antes de la segunda ejecución, podrían quedar dos loops corriendo en paralelo (juego el doble de rápido, listeners duplicados). Mitigación: cleanup explícito del RAF (`cancelAnimationFrame`) y de los listeners en el `return` del efecto, sin depender del orden de montaje.
- **Fuga de listeners de teclado.** Si `window.addEventListener('keydown'/'keyup')` no se limpia al desmontar o al navegar fuera de `/game/asteroids/play`, las flechas/espacio podrían seguir siendo interceptadas (con `preventDefault`) en otras pantallas, rompiendo scroll o inputs de otras páginas. Mitigación: listeners scopeados al ciclo de vida del componente, nunca a nivel de módulo (a diferencia del original `game.js`, que los registra globalmente al cargar el script).
- **Recorte/deformación del canvas en resize.** Si el cálculo de tamaño real vs. mundo lógico (800×600) no se recalcula en cada resize del contenedor `.crt-screen`, el juego podría verse recortado o con proporciones incorrectas en breakpoints móviles. Mitigación: `ResizeObserver` sobre el contenedor, recalculando el escalado del canvas sin tocar las coordenadas de mundo del motor.
- **Power-up no aparece durante el QA manual.** El drop es probabilístico (`POWERUP_DROP_CHANCE = 0.15`) aunque garantizado tras 5 kills sin drop (`killsSinceSpawn >= 5`); si el QA no destruye suficientes asteroides, el criterio de aceptación del power-up podría no verificarse. Mitigación: el criterio de aceptación ya asume jugar lo suficiente para activar el drop garantizado.

## What is **not** in this spec

- Controles táctiles/móviles.
- Recalcular `best`/`plays` de `asteroids` a partir de partidas reales.
- Conectar leaderboards (`/game/asteroids`, `/hall-of-fame`) a puntajes reales.
- Guardar puntajes o el catálogo de juegos en Supabase.
- Sonido/haptics.
- Motores de juego reales para los otros 7 juegos del catálogo o para `rocas`.
- Abstracción compartida (`GameEngine` genérico) entre motores de juego.

Cada uno de estos, si se implementa, va en su propio spec.
