# SPEC 03 — Página About y envío de correo de contacto con Resend

> **Status:** aprobado
> **Depends on:** 01-mvp-visual-screens, 02-home-and-games-route
> **Date:** 2026-07-27
> **Objective:** Portar la pantalla "Acerca de" de `references/templates/home-about/about.jsx` a `/about`, con su formulario de contacto conectado a un endpoint real que envía el mensaje por correo usando Resend.

## Scope

**In:**

- Nueva pantalla "Acerca de" en `/about` (`app/about/page.tsx`), port fiel de `references/templates/home-about/about.jsx`: hero con misión, fila de 3 highlights (HECHO CON ❤️, JUEGOS EN HTML, PROYECTO EN CRECIMIENTO), divisor animado, y sección de contacto con formulario (nombre, correo, mensaje).
- Animación de aparición al hacer scroll (reutilizando el hook `useReveal` ya portado en `app/page.tsx` en SPEC 02) para las secciones marcadas `.reveal`.
- Nav (`components/Nav.tsx`) actualizado con el link "Acerca de" (→ `/about`) en el menú desktop y en el panel móvil hamburguesa, junto a Inicio/Biblioteca/Salón de la Fama.
- Endpoint `app/api/contact/route.ts` (Route Handler, `POST`) que recibe `{ name, email, message }`, valida en servidor (campos no vacíos, formato de correo válido) y envía el correo usando el SDK `resend`.
- Correo enviado con `from` = `process.env.RESEND_FROM_EMAIL`, `to` = `process.env.CONTACT_TO_EMAIL`, `reply-to` = el correo que escribió el visitante, asunto y cuerpo con nombre/correo/mensaje del formulario.
- Formulario del cliente (`About`) conectado al endpoint vía `fetch`: mantiene la validación de campos vacíos existente (shake), agrega estado de envío en curso, éxito (terminal animado ya presente en el template) y error (terminal en variante de error, con botón para reintentar).
- Paquete `resend` agregado a `dependencies` en `package.json`.
- Variables de entorno `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (valor sandbox `onboarding@resend.dev`) y `CONTACT_TO_EMAIL` (valor `cozjosue0@gmail.com`) documentadas en `.env.example` y usadas desde `.env.local` (no versionado, ya cubierto por `.gitignore`).
- Porte a `app/globals.css` de las clases CSS de About/Contacto que falten (`.about-*`, `.contact-*`, `.highlight*`, `.hl-*`, `.div-*`, `.terminal-success`, `.term-*`), diffeando contra `references/templates/home-about/styles.css`, más las clases nuevas de la variante de error de la terminal.

**Out of scope (for future specs):**

- Dominio propio verificado en Resend — se usa el modo sandbox (`onboarding@resend.dev`) hasta que exista un spec de dominio/email transaccional real.
- Protección anti-spam (honeypot, rate limiting, captcha).
- Persistencia de los mensajes de contacto en base de datos o `localStorage` — el mensaje solo se envía por correo, no se guarda.
- Link a "Acerca de" en el footer (el template tampoco lo tiene).
- Cualquier otro alcance ya excluido en `01-mvp-visual-screens.md` y `02-home-and-games-route.md` (motor de juego real, auth real, etc.).

## Data model

Este feature no introduce estructuras de datos persistentes nuevas (no hay base de datos ni `localStorage`). Sí define las formas de request/response del endpoint de contacto:

```ts
// app/api/contact/route.ts

type ContactRequestBody = {
  name: string;
  email: string;
  message: string;
};

type ContactResponseBody =
  | { ok: true }
  | { ok: false; error: string };
```

Variables de entorno (`.env.local`, documentadas en `.env.example`):

```
RESEND_API_KEY=
RESEND_FROM_EMAIL=onboarding@resend.dev
CONTACT_TO_EMAIL=cozjosue0@gmail.com
```

Convenciones:

- `RESEND_API_KEY` no tiene valor por defecto — el endpoint responde `{ ok: false, error: "..." }` (HTTP 500) si falta, en vez de fallar de forma críptica.
- La validación de servidor reutiliza una regex simple de formato de correo (no verificación de dominio real).

## Implementation plan

1. Instalar `resend` (`npm install resend`), crear `.env.example` documentando `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CONTACT_TO_EMAIL`, y agregar `.env.local` (no versionado) con los valores sandbox por defecto y `RESEND_API_KEY` vacío.
2. Diferenciar `app/globals.css` contra `references/templates/home-about/styles.css` y portar las clases de About/Contacto (`.about-*`, `.contact-*`, `.highlight*`, `.hl-*`, `.div-*`, `.terminal-success`, `.term-*`), agregando además una variante visual de error para la terminal (ej. `.terminal-success.error`).
3. Crear `app/about/page.tsx` con el port fiel del contenido visual de `about.jsx` (hero, highlights, divisor, formulario de contacto), formulario con la misma validación de campos vacíos (shake) que el template, sin envío real todavía.
4. Implementar `app/api/contact/route.ts`: parsear y validar el body (campos no vacíos, formato de correo), responder `400` si la validación falla, `500` si falta `RESEND_API_KEY` o Resend devuelve error, y llamar `resend.emails.send` con `from`/`to`/`reply-to` cuando todo es válido.
5. Conectar el formulario de `app/about/page.tsx` al endpoint (`fetch('/api/contact', ...)`), manejando estados `idle | sending | sent | error`: éxito reutiliza la terminal animada del template, error muestra la nueva terminal de error con botón "Reintentar".
6. Actualizar `components/Nav.tsx`: agregar el link "Acerca de" (→ `/about`) en el menú desktop y en el panel móvil, extendiendo `isActive` para reconocer `"about"`.
7. QA manual: enviar el formulario con y sin `RESEND_API_KEY` configurada para verificar ambos estados (éxito/error), probar validación de servidor con un `curl` a `/api/contact` con datos inválidos, verificar que el Nav resalta "Acerca de" en `/about`, y correr `npm run build` y `npm run lint` sin errores.

## Acceptance criteria

- [ ] `/about` muestra el hero, la fila de 3 highlights, el divisor animado y la sección de contacto, con fidelidad visual al template `about.jsx`.
- [ ] Las secciones marcadas `.reveal` en `/about` aparecen animadas al hacer scroll hasta ellas.
- [ ] El Nav muestra "Acerca de" en desktop y en el panel móvil, y queda resaltado como activo únicamente en `/about`.
- [ ] Enviar el formulario con algún campo vacío dispara la animación de shake y no hace ninguna petición de red.
- [ ] Enviar el formulario con datos válidos hace `POST` a `/api/contact` y, si Resend responde con éxito, muestra la terminal de éxito con el nombre del remitente.
- [ ] Si `/api/contact` responde con error (por ejemplo `RESEND_API_KEY` ausente o inválida), el formulario muestra la terminal de error con opción de "Reintentar" sin perder los datos escritos.
- [ ] Un `POST` directo a `/api/contact` con un correo con formato inválido responde `400` y no llama a Resend.
- [ ] Un `POST` directo a `/api/contact` sin `RESEND_API_KEY` configurada responde `500` con `{ ok: false, error: "..." }`.
- [ ] El correo recibido en `CONTACT_TO_EMAIL` tiene como `reply-to` el correo escrito por el visitante en el formulario.
- [ ] `.env.local` no se sube a git (ya cubierto por `.gitignore`) y `.env.example` documenta las 3 variables sin valores secretos.
- [ ] `npm run build` y `npm run lint` terminan sin errores.

## Decisions

- **Sí:** ruta `/about` en inglés. Consistente con la convención ya fijada en SPEC 01 (`/game/[id]`, `/hall-of-fame`, `/login`) aunque la UI esté en español.
- **No:** ruta `/acerca-de`. Descartado por consistencia con el resto de rutas del proyecto.
- **Sí:** agregar el link "Acerca de" al Nav en este mismo spec. Sin esto la página quedaría inalcanzable desde la navegación normal.
- **Sí:** Route Handler (`app/api/contact/route.ts`) en vez de Server Action. Da un endpoint POST explícito, fácil de probar de forma aislada (curl) y separa claramente el límite cliente/servidor donde ocurre la validación real.
- **Sí:** modo sandbox de Resend (`onboarding@resend.dev`) como remitente por defecto, sin dominio propio verificado. Suficiente para MVP; migrar a dominio propio es un spec futuro.
- **Sí:** `RESEND_FROM_EMAIL` y `CONTACT_TO_EMAIL` configurables por variable de entorno (no hardcodeadas). Mantiene toda la configuración de correo en un solo lugar y facilita el cambio a un dominio propio después sin tocar código.
- **Sí:** validación duplicada en servidor (además de la del cliente). El endpoint es alcanzable directamente sin pasar por el formulario, así que no puede confiar solo en la validación de React.
- **Sí:** estado de error con terminal a juego (variante roja de la terminal de éxito ya existente), en vez de un mensaje inline. Consistencia visual con el resto del template.
- **Sí:** `reply-to` = correo del visitante en el email enviado. Permite responder directo desde el cliente de correo del equipo.
- **No:** protección anti-spam (honeypot, rate limiting) en este spec. MVP simple; se evalúa si se vuelve un problema real.
- **No:** persistir los mensajes de contacto en base de datos o `localStorage`. Solo se envían por correo.

## Risks

| Risk                                                                 | Mitigation                                                                                          |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY` no configurada al probar en desarrollo             | El endpoint responde `500` con mensaje claro; la UI muestra la terminal de error en vez de fallar en silencio. |
| Modo sandbox de Resend solo permite enviar al correo dueño de la cuenta | Documentado en `.env.example`; si `CONTACT_TO_EMAIL` no coincide con esa cuenta, Resend rechazará el envío y se verá reflejado en la terminal de error. |
| Variables de entorno con valores reales commiteadas por error        | `.env*` ya está en `.gitignore`; solo `.env.example` (sin secretos) se versiona.                     |

## What is **not** in this spec

- Dominio propio verificado en Resend (se usa el modo sandbox `onboarding@resend.dev`).
- Protección anti-spam (honeypot, rate limiting, captcha).
- Persistencia de los mensajes de contacto en base de datos o `localStorage`.
- Link a "Acerca de" en el footer.
- Motor de juego real, autenticación real, login social, y cualquier otro alcance ya excluido en `01-mvp-visual-screens.md` y `02-home-and-games-route.md`.

Cada uno de estos, si se implementa, va en su propia spec.
