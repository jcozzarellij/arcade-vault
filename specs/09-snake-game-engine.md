# SPEC 09 — Motor real de Snake

> **Status:** aprobado
> **Depends on:** 05-asteroides-game-engine, 06-leaderboard-y-catalogo-supabase
> **Date:** 2026-08-17
> **Objective:** Construir un motor de Snake en TypeScript desde cero (sin código de referencia, solo con el spritesheet `fruits.png`/`sprites.js` provisto por el usuario), jugable en `/game/snake/play`, agregando una nueva fila `snake` al catálogo Supabase y registrándolo en `components/games/registry.ts` junto a `asteroids`, `tetris` y `arkanoid`.

## Scope

**In:**

- Nueva fila en la tabla `games` de Supabase (`INSERT`, vía `apply_migration`) con `id: "snake"`, `title: "SNAKE"`, `cat: "ARCADE"`, `cover: "cover-snake"` (reutilizada, misma clase que usa hoy el placeholder `serpentina`), `color: "green"`, `plays: "0"`. La fila `serpentina` no se toca.
- Motor de juego construido desde cero en `lib/games/snake/engine.ts`: grilla de 40×30 celdas de 20px (mundo 800×600, 4:3 exacto), serpiente como lista de segmentos, movimiento por pasos de grilla, cola de dirección con un solo giro en buffer, wrap-around toroidal en los 4 bordes, colisión consigo misma, consumo de fruta con crecimiento, ciclo de nivel/fruta (ver Data model), curva de velocidad por nivel con tope — sin dependencias de React ni del DOM salvo la extensión puntual descrita abajo para dibujar sprites.
- Uso real del spritesheet: `lib/games/snake/spriteAtlas.ts` porta las coordenadas de `sprites.js` (21 frutas) como constante TS; `public/games/snake/fruits.png` aloja la imagen. El motor dibuja la fruta actual con `ctx.drawImage` recortando del atlas.
- Componente `components/games/SnakeCanvas.tsx`: mismo template que `AsteroidesCanvas.tsx`/`TetrisCanvas.tsx`/`ArkanoidCanvas.tsx` (RAF loop, `KEY_MAP` con las 4 flechas, DPR + `ResizeObserver`, refs para props, cleanup al desmontar), más la precarga de `fruits.png` vía `new Image()` en un `useEffect` de montaje, entregada al motor una sola vez que carga.
- Registro de `snake` en `components/games/registry.ts`: `{ Canvas: SnakeCanvas, hasLives: false, extraStat: { label: "Longitud", select: ... } }`.
- HUD: "Puntuación" y "Nivel" alimentados del motor real; "Vidas" **oculto** (`hasLives: false`); quinto `hud-stat` muestra "Longitud" (segmentos actuales de la serpiente), siempre visible.
- Botón PAUSA / RENDIRSE / modal de fin de partida / "JUGAR DE NUEVO" / "SALIR": mismo flujo ya existente en el shell, cableado a través del registry.
- Guardado de puntaje real vía `saveScore()` (Supabase `scores`), habilitado para `snake` igual que para los otros 3 juegos con motor real.

**Out of scope (para specs futuras):**

- Controles táctiles/móviles (swipe) — solo teclado (flechas) en este spec.
- Sonido/haptics.
- Muerte por colisión de pared — se decide wrap-around toroidal (ver Decisions); si se quisiera un modo "pared mata" en el futuro, es un spec propio (o un toggle).
- Power-ups o frutas especiales con efectos distintos a crecer/sumar puntos (ej. fruta venenosa, velocidad temporal) — todas las 21 frutas del atlas son cosméticas, mismo valor de puntaje.
- Multijugador / segunda serpiente.
- Actualizar dinámicamente `plays` de `snake` a partir de partidas reales — queda como mock estático `"0"`.
- Cualquier retuning posterior de la curva de velocidad/puntaje una vez jugado — se ajusta si el QA lo pide, pero no hay una referencia externa que "portar tal cual".
- Repurposear/eliminar la fila `serpentina` — queda intacta.
- Motores de juego reales para los demás placeholders del catálogo (`gloton`, `invasores`, `ranaria`, `duelo-pixel`, `rocas`).

## Data model

**Supabase — migración SQL** (aplicada vía `apply_migration` durante la implementación, no en este spec):

```sql
insert into games (id, title, short, long, cat, cover, color, plays)
values (
  'snake', 'SNAKE',
  'Guía a la serpiente entre frutas reales, crece sin morderte a ti mismo.',
  'Muévete por una grilla infinita (los bordes envuelven) devorando frutas reales de un spritesheet de 21 variedades. Cada fruta te hace crecer, sube tu nivel y acelera el ritmo del juego. El único enemigo eres tú: un giro en falso sobre tu propia cola termina la partida.',
  'ARCADE', 'cover-snake', 'green', '0'
);
```

**`lib/games/snake/spriteAtlas.ts`** — port de `sprites.js` (solo datos, sin lógica):

```ts
export type SpriteRect = { x: number; y: number; w: number; h: number };

export const FRUITS_SRC = "/games/snake/fruits.png";

// Orden = orden de sprites.js = orden del ciclo de niveles (ver Decisions).
export const FRUIT_ORDER = [
  "banana",
  "orange",
  "grape",
  "garlic",
  "eggplant",
  "strawberry",
  "cherry",
  "carrot",
  "mushroom",
  "broccoli",
  "watermelon",
  "pepper",
  "kiwi",
  "lemon",
  "peach",
  "peanut",
  "apple",
  "tomato",
  "berries",
  "grapes2",
  "pineapple",
  "melon",
] as const;

export const FRUIT_ATLAS: Record<(typeof FRUIT_ORDER)[number], SpriteRect> = {
  /* coordenadas 1:1 desde sprites.js */
};
```

**`lib/games/snake/engine.ts`** — motor framework-agnostic:

```ts
export const WORLD_W = 800;
export const WORLD_H = 600;

export type SnakeInput = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean; // los 4 se resuelven edge-triggered dentro del motor (flags "prev*"), con un giro en buffer
};

export type SnakeState = {
  status: "playing" | "gameover"; // sin "dead": Snake no tiene vidas/respawn
  score: number;
  level: number; // 1..21, cíclico — índice de FRUIT_ORDER que define la fruta actual
  length: number; // segmentos actuales de la serpiente
};

export class SnakeEngine {
  constructor();
  reset(): void;
  update(dt: number, input: SnakeInput): void;
  draw(ctx: CanvasRenderingContext2D): void;
  getState(): SnakeState;

  // Extensión al contrato de motor (ver Decisions): permite que el componente
  // React entregue la imagen ya precargada, sin que el motor toque `Image`/`document`.
  setSprites(image: HTMLImageElement | null): void;
}
```

Constantes privadas del módulo: `CELL=20`, `COLS=40`, `ROWS=30` (grilla 800×600), longitud inicial `3`, crecimiento `+1` segmento/fruta, `SCORE_PER_FRUIT=10`, `BASE_SPEED=6` (celdas/seg), `SPEED_STEP=1.04` (multiplicador por nivel), `SPEED_CAP=2.2×BASE_SPEED`.

**`components/games/SnakeCanvas.tsx`** — mismas props fijas que los otros 3 canvases:

```ts
type SnakeCanvasProps = {
  paused: boolean;
  onStateChange: (state: SnakeState) => void;
  onGameOver: (finalScore: number) => void;
  restartSignal: number;
};
```

`KEY_MAP`: `ArrowUp→up`, `ArrowDown→down`, `ArrowLeft→left`, `ArrowRight→right`.

**`components/games/registry.ts`** — nueva entrada:

```ts
snake: {
  Canvas: SnakeCanvas,
  hasLives: false,
  extraStat: {
    label: "Longitud",
    select: (s) => String((s as SnakeState).length),
  },
},
```

## Implementation plan

1. Crear `lib/games/snake/spriteAtlas.ts`: portar las coordenadas de `references/source_assets/snake-assets/sprites.js` a la constante TS `FRUIT_ATLAS` + `FRUIT_ORDER` (Data model). Copiar `fruits.png` a `public/games/snake/fruits.png`.
2. Crear `lib/games/snake/engine.ts`: grilla 40×30, cola de segmentos, cola de dirección con un giro en buffer (bloqueando el giro de 180° hacia el propio cuello), wrap-around en los 4 bordes, detección de auto-colisión, spawn de fruta en celda libre, consumo → crecimiento + puntaje + avance de nivel/fruta según `FRUIT_ORDER` (cíclico, módulo 21) + aumento de velocidad (`SPEED_STEP` por nivel, con `SPEED_CAP`), `draw(ctx)` dibuja grilla/serpiente con formas de canvas y la fruta actual vía `ctx.drawImage` sobre la imagen entregada por `setSprites()` (si aún no llegó la imagen, dibuja un círculo de color como fallback). Sin `window`/`document`/`requestAnimationFrame` dentro del motor.
3. Crear `components/games/SnakeCanvas.tsx` copiando la estructura de `ArkanoidCanvas.tsx`: precarga `fruits.png` con `new Image()` en el montaje y llama `engine.setSprites(img)` cuando carga; `KEY_MAP` (4 flechas), refs para `paused`/`onStateChange`/`onGameOver`, DPR + `ResizeObserver`, loop RAF con `dt` capado a 50ms, `onGameOver` latcheado a un solo disparo, `restartSignal` saltando su primera invocación, cleanup completo al desmontar.
4. Agregar la entrada `snake` a `GAME_REGISTRY` (`Canvas: SnakeCanvas`, `hasLives: false`, `extraStat` "Longitud"). Verificar en `GamePlayerClient` que "Vidas" no aparece y "Longitud" sí.
5. Migración Supabase `insert_snake_game`: `INSERT` de la fila `snake` en `games` (Data model). Verificar con `execute_sql`/`list_tables` que quedó insertada y que `serpentina` no cambió.
6. QA manual: mover en las 4 direcciones, verificar que no se puede girar 180° sobre el propio cuello, cruzar los 4 bordes y reaparecer del lado opuesto, comer fruta y ver el sprite real dibujado + crecimiento + subida de nivel + cambio de fruta siguiendo `FRUIT_ORDER`, completar el ciclo de 21 frutas y confirmar que vuelve a `banana` sin romperse, chocar contra la propia cola y ver el modal de fin con el puntaje real, guardar puntuación, "JUGAR DE NUEVO", "RENDIRSE" a mitad de partida, PAUSA/REANUDAR congelando el juego (incluida la fruta), "SALIR" sin errores en consola; probar en al menos dos anchos de viewport; correr `npm run build` y `npm run lint` sin errores.

## Acceptance criteria

- [ ] `games` incluye la fila `id: "snake"` con los campos definidos en Data model; `serpentina` y el resto del catálogo no cambian.
- [ ] `/game/snake` (Detalle) muestra la info del juego y "JUGAR AHORA" navega a `/game/snake/play`.
- [ ] `/game/snake/play` renderiza el canvas real dentro de `.crt-screen`, escalado sin deformar la proporción 4:3.
- [ ] La serpiente se mueve con las 4 flechas; un giro directo de 180° sobre el propio cuello es ignorado (no causa colisión inmediata).
- [ ] Al cruzar cualquiera de los 4 bordes del mundo, la serpiente reaparece del lado opuesto sin perder velocidad ni segmentos.
- [ ] Comer una fruta dibuja el sprite real correspondiente del atlas (no una forma vectorial genérica, salvo el breve fallback antes de que cargue la imagen), suma `SCORE_PER_FRUIT` puntos, agrega un segmento y avanza al siguiente nivel/fruta según `FRUIT_ORDER`.
- [ ] La velocidad de movimiento aumenta en cada nivel según `SPEED_STEP`, sin superar `SPEED_CAP`.
- [ ] El HUD muestra Puntuación y Nivel reales en cada frame; "Vidas" no se muestra; el quinto `hud-stat` "Longitud" refleja el número real de segmentos.
- [ ] Chocar contra el propio cuerpo abre automáticamente el modal de fin de partida existente con el puntaje real acumulado.
- [ ] El botón "RENDIRSE" termina la partida manualmente en cualquier momento y abre el mismo modal con el puntaje acumulado hasta ese instante.
- [ ] Guardar puntuación en el modal escribe una fila real en `scores` (vía `saveScore`) y muestra "PUNTUACIÓN GUARDADA".
- [ ] "JUGAR DE NUEVO" reinicia el motor a un estado limpio (longitud 3, score 0, nivel 1/`banana`) sin recargar la página.
- [ ] PAUSA congela por completo el juego (la serpiente no avanza) y muestra el overlay "EN PAUSA"; REANUDAR continúa exactamente donde quedó.
- [ ] "SALIR" navega a `/game/snake` sin errores en consola y sin que el loop siga corriendo en segundo plano.
- [ ] Al salir de `/game/snake/play` y volver, el juego arranca limpio (sin estado ni listeners de teclado residuales, sin fugas de la imagen precargada).
- [ ] El resto del catálogo (incluido `serpentina`) conserva el shell visual estático sin cambios de comportamiento.
- [ ] `npm run build` y `npm run lint` terminan sin errores.

## Decisions

- **Sí:** definición rápida sin ronda completa de aclaraciones — el usuario pidió explícitamente generar el spec con mis recomendaciones tras el primer bloque de preguntas de catálogo. Las decisiones de mecánica (grilla, bordes, vidas, HUD, assets, ciclo de frutas, puntaje, velocidad) quedan documentadas aquí como recomendaciones aplicadas, no como respuestas confirmadas pregunta por pregunta.
- **Sí:** `id: "snake"`, `title: "SNAKE"` — confirmado por el usuario.
- **Sí:** insertar `snake` como fila NUEVA en `games`, dejando `serpentina` intacta — confirmado por el usuario, mismo criterio que `rocas`→`asteroids`, `caida`→`tetris`, `bloque-buster`→`arkanoid`.
- **Sí:** reutilizar `cover-snake` (ya usada por `serpentina`) — confirmado por el usuario, mismo precedente que `asteroids` reutilizando `cover-rocas`.
- **Sí:** `color: "green"` — confirmado por el usuario.
- **Sí:** grilla de 40×30 celdas de 20px sobre el mundo fijo 800×600 (igual convención que `asteroids`/`tetris`/`arkanoid`, ya ajustado a `.crt-screen` 4:3). Recomendación aplicada por densidad de juego razonable.
- **Sí:** bordes con wrap-around toroidal; solo el auto-mordisco termina la partida. El copy ya existente del catálogo para `serpentina` ("un movimiento en falso y se devora a sí misma") no menciona paredes, y `asteroids` ya estableció el wrapping toroidal como un patrón válido de la plataforma.
- **No:** morir al tocar el borde (estilo Nokia). Se descarta por la razón anterior; queda como posible variante/modo futuro fuera de este spec.
- **Sí:** sin concepto de vidas (`hasLives: false`, `SnakeState.status` sin estado `"dead"` intermedio) — diseño clásico de Snake, mismo criterio que Tetris.
- **No:** 3 vidas con respawn. Se descarta por alejarse del diseño clásico de Snake sin una razón fuerte para agregarlo.
- **Sí:** quinto `hud-stat` = "Longitud" (segmentos de la serpiente), siempre visible. Es el stat más natural y con valor constante, igual criterio que "Líneas" en Tetris.
- **Sí:** usar el spritesheet real (`fruits.png`) para dibujar la fruta, en vez de mantener el motor 100% vectorial como los 3 juegos anteriores. El usuario pidió explícitamente usar sus assets — es la razón de ser de este spec.
- **Sí:** extender el contrato del motor con un método adicional `setSprites(image)` fuera de los 5 símbolos fijos que define la sección A del contrato de integración. Es el primer juego de la plataforma con un asset de imagen real; la alternativa (que el motor cree su propio `Image`/toque `document`) rompería la regla de "cero dependencias DOM en el motor", así que la carga vive en el componente React y solo la referencia ya cargada se entrega al motor. Se documenta como extensión explícita del contrato, no como violación silenciosa — vale la pena revisar `references/integration-contract.md` sección A cuando se implemente, para anotar este precedente.
- **Sí:** `sprites.js` se porta como constante TS (`spriteAtlas.ts`), no como archivo de lógica — es solo un mapa de coordenadas, no gameplay.
- **Sí:** ciclo de nivel = ciclo de fruta, siguiendo el orden exacto de `FRUIT_ORDER` (el mismo orden en que aparecen en `sprites.js`), cíclico módulo 21. Conecta el HUD "Nivel" con la fruta mostrada de forma visualmente clara, y es fiel al origen del atlas (recortado del Google Snake real, que usa un ciclo de frutas por nivel).
- **No:** fruta aleatoria sin relación con el nivel. Se descarta por la razón anterior — perdería la conexión Nivel↔Fruta que el propio atlas sugiere.
- **Sí:** todas las 21 frutas son cosméticas, mismo valor de puntaje (`SCORE_PER_FRUIT=10` fijo). Mantiene la mecánica simple; no hay información de balance real que soporte puntajes distintos por fruta.
- **Sí:** velocidad aumenta un paso fijo (`SPEED_STEP=1.04`) por nivel, con un tope (`SPEED_CAP=2.2×BASE_SPEED`) para que el juego siga siendo jugable en niveles altos, en vez de escalar sin límite.
- **Sí:** dirección con un giro en buffer (edge-triggered) que bloquea la reversión directa de 180° hacia el propio cuello — evita una muerte instantánea "gratis" por lag de input, comportamiento estándar de cualquier implementación moderna de Snake.
- **Sí:** reutilizar `components/games/registry.ts` ya existente (creado en spec 07) — `snake` solo agrega una entrada nueva, sin refactor adicional al shell.
- **No:** sonido, controles táctiles, multijugador, frutas con efectos especiales, recalcular `plays` real. Fuera de alcance, consistente con specs 05/06/07/08.

## Identified risks

- **Carrera de carga de imagen.** Si `fruits.png` tarda en cargar (conexión lenta) y el motor ya empezó a dibujar antes de que `setSprites()` se llame, la fruta debe mostrarse con un fallback vectorial (círculo de color) en vez de romper el `draw()` o dejar un hueco en blanco. Mitigación: el motor chequea `spriteImage !== null` antes de cada `drawImage`, con fallback siempre disponible.
- **Extensión al contrato de motor.** `setSprites()` es el primer método fuera del contrato fijo de 5 símbolos — si una futura auditoría del contrato de integración no lo tiene en cuenta, podría tratarse como una desviación no documentada. Mitigación: queda registrado explícitamente en Decisions y debe reflejarse en `references/integration-contract.md` durante la implementación.
- **Doble loop por Strict Mode.** Igual que en los 3 motores anteriores: si el `useEffect` de `SnakeCanvas` no cancela el `requestAnimationFrame` y remueve listeners antes del segundo montaje de desarrollo, el juego correría el doble de rápido. Mitigación: mismo patrón de cleanup ya validado.
- **Fuga de listeners de teclado.** Si los listeners de `window` no se limpian al desmontar/navegar fuera de `/game/snake/play`, las flechas seguirían interceptadas en otras pantallas. Mitigación: listeners scopeados al ciclo de vida del componente.
- **Bug de reversión de 180°.** Si el buffer de dirección no valida correctamente contra la dirección actual (no la última tecla presionada, sino el movimiento real del frame anterior), la serpiente podría "morderse" instantáneamente por un giro que el jugador no quiso hacer. Mitigación: el criterio de aceptación de QA prueba explícitamente giros rápidos en secuencia.
- **Wrap-around mal calculado en los bordes.** Un error de módulo en `x`/`y` al cruzar el borde podría teletransportar la serpiente a una celda incorrecta o duplicar/perder un segmento. Mitigación: el QA prueba explícitamente cruzar los 4 bordes.

## What is **not** in this spec

- Controles táctiles/móviles.
- Sonido/haptics.
- Muerte por colisión de pared (queda wrap-around).
- Frutas especiales con efectos distintos a crecer/sumar puntos.
- Multijugador.
- Recalcular `plays` de `snake` a partir de partidas reales.
- Repurposear o eliminar la fila `serpentina`.
- Motores de juego reales para los demás placeholders del catálogo.

Cada uno de estos, si se implementa, va en su propio spec.
