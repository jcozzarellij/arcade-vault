# SPEC 04 — Integración del SDK de Supabase

> **Status:** aprobado
> **Depends on:** 01-mvp-visual-screens
> **Date:** 2026-07-30
> **Objective:** Integrar el SDK de Supabase (@supabase/ssr) como infraestructura base — variables de entorno, helpers de cliente para browser y servidor, y sincronización de sesión vía `proxy.ts` — reutilizable por futuros specs de auth, base de datos y realtime.

## Scope

**In:**

- Instalar `@supabase/supabase-js` y `@supabase/ssr` como dependencias del proyecto.
- Variables de entorno en `.env.local`: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, confirmando que `.env.local` está ignorado por git.
- `utils/supabase/client.ts` — helper de cliente para browser (`createBrowserClient`).
- `utils/supabase/server.ts` — helper de cliente para Server Components / Route Handlers (`createServerClient`, cookies de `next/headers`).
- `utils/supabase/proxy.ts` — helper que crea el cliente de Supabase a partir de un `NextRequest` y refresca la sesión (equivalente al `middleware.ts` clásico, pero como módulo separado).
- `proxy.ts` en la raíz del proyecto — convención de Next.js 16 (reemplaza a `middleware.ts`), invoca al helper anterior en cada request para mantener la sesión sincronizada vía cookies.
- Verificación de que el SDK conecta correctamente (build sin errores + smoke check manual, ej. `supabase.auth.getSession()` sin excepciones).

**Out of scope (para specs futuras):**

- Modificar `app/login/page.tsx` o cualquier pantalla existente.
- Reemplazar `lib/session.ts` / `av_user` por sesión real (eso es el spec de **Auth**).
- Flujos de autenticación (email/password, social login, signup, logout).
- Tablas, esquema de base de datos y RLS (spec de **Database**).
- Suscripciones o canales realtime (spec de **Realtime**).
- Protección de rutas / redirects en `proxy.ts` más allá de refrescar la sesión.
- Migración de puntajes / Hall of Fame a Supabase.

## Data model

Este spec no introduce estructuras de datos nuevas (no hay tablas, tipos ni modelos) — solo configuración de clientes y variables de entorno.

## Implementation plan

1. Instalar dependencias: `npm install @supabase/supabase-js @supabase/ssr` (versiones se fijan al lockfile, sin rangos sueltos).
2. Crear `.env.local` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; confirmar que `.gitignore` ya cubre `.env*.local` (viene por defecto en el scaffold de Next.js).
3. Crear `utils/supabase/client.ts` con `createClient()` usando `createBrowserClient` de `@supabase/ssr`.
4. Crear `utils/supabase/server.ts` con `createClient()` usando `createServerClient`, leyendo/escribiendo cookies vía `cookies()` de `next/headers` (server-only, para Server Components y Route Handlers).
5. Crear `utils/supabase/proxy.ts` con la lógica de refresco de sesión (equivalente al `middleware.ts` del snippet de Supabase), recibiendo un `NextRequest` y devolviendo el `NextResponse` con las cookies de sesión sincronizadas.
6. Crear `proxy.ts` en la raíz del proyecto (convención Next.js 16, no `middleware.ts`) que importa y ejecuta el helper de `utils/supabase/proxy.ts` en cada request, con `matcher` que excluye assets estáticos.
7. Verificación: `npm run build` sin errores, `npm run lint` sin errores, y un smoke check manual en `npm run dev` (una llamada temporal a `supabase.auth.getSession()` desde una Server Component o consola del navegador, confirmando que responde `{ session: null }` sin excepciones — sin login real todavía).

## Acceptance criteria

- [ ] `@supabase/supabase-js` y `@supabase/ssr` están en `package.json` y `package-lock.json`.
- [ ] `.env.local` existe con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, y no está trackeado por git (`git status` no lo muestra).
- [ ] `utils/supabase/client.ts` exporta un `createClient()` que instancia un cliente browser sin lanzar errores.
- [ ] `utils/supabase/server.ts` exporta un `createClient()` que instancia un cliente server-side leyendo cookies de `next/headers` sin lanzar errores.
- [ ] `utils/supabase/proxy.ts` exporta la lógica de refresco de sesión, aceptando un `NextRequest` y devolviendo un `NextResponse` con las cookies de Supabase sincronizadas.
- [ ] `proxy.ts` existe en la raíz del proyecto (no `middleware.ts`), importa el helper anterior, y se ejecuta en cada request según su `matcher`.
- [ ] `npm run build` termina sin errores.
- [ ] `npm run lint` termina sin errores.
- [ ] Smoke check manual: con `npm run dev` corriendo, una llamada a `supabase.auth.getSession()` responde sin excepciones (sesión `null`, ya que no hay login implementado todavía).
- [ ] Ninguna pantalla existente (`login`, `games`, `hall-of-fame`, etc.) cambia de comportamiento — el spec es aditivo, no toca UI.

## Decisions

- **Sí:** acotar este spec a integración del SDK (infraestructura base), sin tocar `login/page.tsx` ni `lib/session.ts`. Evita acoplar la conexión con Supabase a decisiones de UX de auth que todavía no están definidas.
- **No:** login social (Google/GitHub) en este spec. Descartado, queda para el spec de **Auth**.
- **No:** crear tablas, esquema o RLS en este spec. Descartado, queda para el spec de **Database**.
- **No:** suscripciones realtime en este spec. Descartado, queda para el spec de **Realtime**.
- **Sí:** usar `proxy.ts` en vez de `middleware.ts` — Next.js 16 renombró Middleware a Proxy (mismo comportamiento, archivo/convención distinta).
- **Sí:** separar `utils/supabase/proxy.ts` (helper con la lógica) del `proxy.ts` raíz (solo invoca al helper), igual que el snippet original separaba `utils/supabase/middleware.ts` del `middleware.ts` raíz.
- **Sí:** usar las variables `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` con la publishable key (formato `sb_publishable_...`), no la legacy `anon` key.
- **No:** instalar los Agent Skills opcionales de Supabase (`npx skills add supabase/agent-skills`) — ya están presentes en el repo (`.claude/skills/supabase`, `.claude/skills/supabase-postgres-best-practices`), ese paso del snippet no aplica.

## Identified risks

- **Clave equivocada en el cliente.** Si en algún futuro spec se agrega la `service_role`/secret key a un archivo público o a una variable `NEXT_PUBLIC_*`, quedaría expuesta al browser. Mitigación: solo `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` va en variables públicas; cualquier clave secreta futura debe ir sin el prefijo `NEXT_PUBLIC_`.
- **Convención de Next.js 16 no respetada.** Si algún snippet o dependencia futura asume `middleware.ts` (patrón pre-16), el refresco de sesión dejaría de ejecutarse silenciosamente. Mitigación: este spec deja `proxy.ts` como único punto de entrada, documentado en `AGENTS.md`.

## What is **not** in this spec

- Pantallas de login/registro y su lógica.
- Reemplazo de `lib/session.ts` por sesión real.
- Login social funcional.
- Tablas, esquema de base de datos y RLS.
- Realtime.
- Protección de rutas.
- Migración de puntajes / Hall of Fame.

Cada uno de estos, si se implementa, va en su propio spec.
