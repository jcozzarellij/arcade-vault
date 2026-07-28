# SPEC 02 — Home y reubicación de Biblioteca a /games

> **Status:** Aprobado
> **Depends on:** 01-mvp-visual-screens
> **Date:** 2026-07-27
> **Objective:** Crear una pantalla Home real en `/` inspirada en `references/templates/home-about/home.jsx` (sin portar `about.jsx`), y mover la Biblioteca actual (hoy en `/`) a `/games`, actualizando el Nav y todos los enlaces internos que asumían que la Biblioteca vivía en `/`.

## Scope

**In:**

- Nueva pantalla Home en `/` (`app/page.tsx`), inspirada en `references/templates/home-about/home.jsx`, con las 7 secciones del template: Hero (con siluetas flotantes decorativas), "¿Por qué Arcade Vault?", "Juegos disponibles ahora" (rail con los primeros 6 juegos reales de `GAMES`), Stats, "Actividad en vivo" (ticker + top jugadores con datos mock hardcodeados como en el template), Precios (plan único $0/siempre + FAQ) y CTA final.
- Animación de aparición al hacer scroll (`useReveal` + clases `.reveal`/`.in`), portada del template.
- Biblioteca actual movida de `app/page.tsx` a `app/games/page.tsx` (mismo contenido: hero corto, buscador, chips de categoría, grid de `GameCard`), sin cambios funcionales.
- Nav (`components/Nav.tsx`) actualizado: nuevo enlace "Inicio" (→ `/`) antes de "Biblioteca" (→ `/games`), en el menú desktop y en el panel móvil hamburguesa.
- Actualización de los 4 enlaces que hoy asumen que la Biblioteca está en `/`, para que apunten a `/games`:
  - `app/login/page.tsx` — redirect tras iniciar sesión / entrar como invitado.
  - `app/hall-of-fame/page.tsx` — botón "VOLVER A LA BIBLIOTECA".
  - `app/game/[id]/page.tsx` — botón "VOLVER AL VAULT".
  - `app/game/[id]/play/page.tsx` — botón "VOLVER AL VAULT".
- CTAs del Home mapeados a rutas reales: "EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS →", "INSERTAR MONEDA →" → `/games`; "CREAR CUENTA", "EMPEZAR GRATIS →" → `/login`; "VER SALÓN →" → `/hall-of-fame`; tarjetas del rail de juegos → `/game/[id]`.
- Porte a `app/globals.css` de las clases CSS del Home que falten (`.home-*`, `.mini-card`, `.feature-*`, `.stat-*`, `.activity-*`, `.tick-*`, `.top-*`, `.pricing-*`, `.price-*`, `.faq-*`, `.reveal`/`.in`, siluetas `.silo`), diffeando contra `references/templates/home-about/styles.css`.

**Out of scope (for future specs):**

- Pantalla "Acerca de" (`about.jsx`) — no se porta en este spec.
- Datos reales de actividad/ranking (la sección "Actividad en vivo" queda con datos mock hardcodeados, no conectada a `lib/data.ts` ni a backend).
- Cualquier lógica de pago o plan real — la sección "Precios" es puramente visual/decorativa, no hay checkout ni backend de suscripciones.
- Cambios al motor de juego, autenticación real, o cualquier otro alcance ya excluido en `01-mvp-visual-screens.md`.

## Data model

No se introducen estructuras de datos nuevas. El Home reutiliza `GAMES` de `lib/data.ts` (ya existente) para el rail "Juegos disponibles ahora" (`GAMES.slice(0, 6)`). El resto de contenido del Home (features, stats, ticker de actividad, top jugadores, pricing/FAQ) es copy estático definido inline en `app/page.tsx`, igual que en el template — no se persiste ni se deriva de `lib/data.ts`.

## Implementation plan

1. Diferenciar `app/globals.css` contra `references/templates/home-about/styles.css` y portar las clases CSS faltantes del Home (`.home-*`, `.mini-card`, `.feature-*`, `.stat-*`, `.activity-*`, `.tick-*`, `.top-*`, `.pricing-*`, `.price-*`, `.faq-*`, `.silo`, `.reveal`/`.in`).
2. Crear `app/games/page.tsx` con el contenido actual de `app/page.tsx` (Biblioteca), sin cambios funcionales.
3. Reescribir `app/page.tsx` como la nueva Home: hero con siluetas flotantes, hook `useReveal` (IntersectionObserver) para animar secciones `.reveal`, y las 6 secciones restantes (Por qué, Juegos disponibles, Stats, Actividad en vivo, Precios, CTA final), como client component monolítico (mismo patrón que la Biblioteca).
4. Actualizar `components/Nav.tsx`: agregar enlace "Inicio" (→ `/`) antes de "Biblioteca" (→ `/games`) en el menú desktop y en el panel móvil; ajustar `isActive` para que "Inicio" sea exacto en `/` y "Biblioteca" cubra `/games` + `/game/*`.
5. Actualizar los 4 enlaces que apuntaban a `/` esperando la Biblioteca, para que apunten a `/games`: `app/login/page.tsx` (ambos redirects), `app/hall-of-fame/page.tsx` (botón volver), `app/game/[id]/page.tsx` (botón volver), `app/game/[id]/play/page.tsx` (botón volver).
6. QA manual: navegar `/`, `/games`, `/game/[id]`, `/game/[id]/play`, `/login`, `/hall-of-fame`; verificar que el Nav resalta "Inicio" vs "Biblioteca" correctamente; verificar breakpoints móviles del Home; correr `npm run build` y `npm run lint` sin errores.

## Acceptance criteria

- [ ] `/` muestra la nueva pantalla Home con las 7 secciones (Hero, Por qué, Juegos disponibles, Stats, Actividad en vivo, Precios, CTA final).
- [ ] Las secciones marcadas `.reveal` aparecen animadas al hacer scroll hasta ellas (vía `useReveal`).
- [ ] El rail "Juegos disponibles ahora" muestra los primeros 6 juegos de `GAMES` y cada tarjeta enlaza a `/game/[id]` correspondiente.
- [ ] Los CTA "EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS →" e "INSERTAR MONEDA →" navegan a `/games`.
- [ ] Los CTA "CREAR CUENTA" y "EMPEZAR GRATIS →" navegan a `/login`.
- [ ] El CTA "VER SALÓN →" navega a `/hall-of-fame`.
- [ ] `/games` muestra la Biblioteca (hero, buscador, chips, grid) con el mismo comportamiento que tenía antes en `/`.
- [ ] El Nav muestra "Inicio" y "Biblioteca"; "Inicio" está activo solo en `/`, "Biblioteca" está activo en `/games` y en `/game/[id]*`.
- [ ] El panel móvil del Nav incluye ambos enlaces ("Inicio" y "Biblioteca") y funciona igual que antes.
- [ ] Tras iniciar sesión o entrar como invitado en `/login`, la redirección va a `/games` (no a `/`).
- [ ] El botón "volver" en `/hall-of-fame`, `/game/[id]` y `/game/[id]/play` navega a `/games`.
- [ ] `npm run build` y `npm run lint` terminan sin errores.

## Decisions

- **Sí:** portar las 7 secciones completas del template `home.jsx`. Fidelidad total, sin recortes.
- **Sí:** datos de "Actividad en vivo" (ticker + top jugadores) hardcodeados como copy estático, igual que en el template. Es contenido decorativo de marketing, no requiere conectarse a `lib/data.ts`.
- **Sí:** números de la sección Stats como copy fijo del template ("12+ JUEGOS", etc.), sin recalcular desde el catálogo real.
- **No:** portar `about.jsx` ni ninguna otra pantalla del template `home-about/` más allá de Home. Fuera de alcance explícito de este spec.
- **Sí:** mover la Biblioteca de `/` a `/games`, agregando "Inicio" al Nav. Necesario para que Home y Biblioteca convivan como rutas separadas.
- **Sí:** Home como archivo único `app/page.tsx` (client component monolítico), igual que el patrón ya usado en la Biblioteca. Consistencia con el resto del proyecto, sin sobre-modularizar contenido que no se reutiliza.
- **Sí:** portar el hook `useReveal` (IntersectionObserver) y las clases `.reveal`/`.in` para la animación de scroll. Fidelidad visual al template.
- **No:** ninguna lógica de pago real en la sección Precios. Es puramente visual, como en el template.
