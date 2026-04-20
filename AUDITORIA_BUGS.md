# Auditoría de Bugs — UMAG Reglamentos

Fecha: 20 de abril de 2026
Alcance: todo el código fuente (`src/`), configuración (`package.json`, `vite.config.js`, `netlify.toml`, `.gitignore`), SQL de Supabase y build.

Estado previo: **23/23 tests pasan**, build pasa, pero con bugs críticos silenciosos.
Estado posterior: **23/23 tests pasan**, build pasa, bugs críticos corregidos.

---

## Hallazgos y correcciones aplicadas

### Críticos (corregidos)

**1. RLS de Supabase incompatible con el modelo de auth de la app**
`src/config/supabase.js` definía policies con `auth.role() = 'authenticated'`, pero la app nunca llama a `supabase.auth.signIn…()`. Todas las requests viajan con el rol `anon`, así que cualquier INSERT/UPDATE/DELETE/SELECT sería rechazado por RLS y la app caería a localStorage sin avisar al usuario. Efecto visible: “está guardando” pero nada persiste en la base de datos.
Corrección: el SQL comentado ahora incluye dos opciones explícitas: A) policies permisivas con `anon` (uso actual), B) migración a Supabase Auth real con las policies `authenticated`. Documentado también en el README.

**2. Contraseña en plano en localStorage**
`App.jsx` guardaba `umag_saved_pass` en `localStorage` cuando el usuario marcaba "Recordarme". Cualquier script en el origen podía leerla; además quedaba como valor claro incluso tras cerrar sesión.
Corrección: se eliminó por completo el almacenamiento de la contraseña. "Recordarme" ahora solo guarda el nombre de usuario y una bandera. Al abrir la app, se limpia automáticamente cualquier valor legacy `umag_saved_pass` que hubiera quedado de versiones anteriores. La etiqueta del checkbox ahora dice "Recordar mi usuario".

**3. Race / datos duplicados en `handleCreateRegulation`**
Cuando Supabase fallaba, la app mostraba un toast de error, pero seguía creando el reglamento localmente con un ID calculado a partir del máximo local. Al reconectarse con Supabase, ese ID podía chocar con un ID existente en el servidor y la siguiente sincronización sobrescribiría datos.
Corrección: si Supabase falla, NO se crea localmente; se pide reintentar. El modo local solo se activa cuando nunca hubo conexión a Supabase.

**4. Memory leak de blob URLs en `RegulationDetail.jsx`**
El `useEffect` de cleanup solo revocaba las blob URLs que estaban en `formData` al momento del render inicial. Las URLs creadas durante la sesión nunca se revocaban y quedaban en memoria hasta cerrar la pestaña.
Corrección: se introdujo `blobUrlsRef` (un `Set`) donde se registra cada blob URL creada. El cleanup revoca todas al desmontar.

**5. `escapeRegex` mal usado con `indexOf`**
`Normativa.jsx` pasaba el término escapado a `String.indexOf`, que es literal, no regex. Cualquier término con puntos/paréntesis ("Ley 19.886", "Art. 18 g)") dejaba de encontrarse y perdía la ventana de contexto, degradando la detección de asociaciones.
Corrección: se usa el término original (en minúsculas) directamente en `indexOf`.

### Medias (corregidas)

**6. Login sin `<form>`**
Faltaba `type="submit"` y el `<form>` envolvente. Autofill de navegador y algunos gestores de contraseña no funcionaban bien.
Corrección: envuelto en `<form onSubmit={…}>` con botón `type="submit"` y `autoComplete="username"/"current-password"`.

**7. `handleExport` con `data:` URL**
Para exportaciones grandes (cuando se agreguen muchos adjuntos en `observaciones`) el navegador puede truncar la URL. Algunas implementaciones antiguas de Safari limitaban a ~2 MB.
Corrección: ahora usa `Blob + URL.createObjectURL`, y revoca la URL tras 1 segundo.

**8. Imports muertos**
`sanitizeField` importado pero nunca usado en `RegulationDetail.jsx` y `Normativa.jsx`.
Corrección: eliminados.

**9. `.gitignore` con typo + falta de patrones**
`*.timestam` (sin la "p") no ignoraba los archivos `vite.config.js.timestamp-*.mjs`, que se estaban versionando (12 archivos basura en el repo). Además `.netlify/state.json` quedaba tracked.
Corrección: reglas `vite.config.js.timestamp-*`, `*.timestamp-*.mjs`, `.netlify/state.json`.

**10. README desactualizado**
Decía "React desde CDN", "Babel Standalone", "No se requiere comando de build", cuando el proyecto real usa Vite + npm con `npm run build`.
Corrección: README reescrito con setup real, comandos, variables de entorno, instrucciones de Supabase y RLS, y nota de seguridad sobre `VITE_AUTH_PASSWORD`.

---

## Problemas NO corregidos (recomendaciones)

Estos requieren decisiones de producto y se dejan documentados aquí para la próxima iteración:

**A. Autenticación real.** `VITE_AUTH_PASSWORD` se compila en el bundle cliente — cualquiera que inspeccione los chunks JS lo ve. Es obfuscación, no seguridad. Para datos sensibles, migrar a Supabase Auth (email/password o magic links) y activar las policies `authenticated`.

**B. Sin índice único en `numero`.** La tabla `regulations` permite duplicados de `numero`. Si se quiere forzar unicidad: `CREATE UNIQUE INDEX regulations_numero_key ON regulations (numero);`.

**C. Falta de error boundary.** Si un chunk `React.lazy(...)` falla en red (ej. deploy en curso), la UI queda en blanco. Recomendado envolver `<Suspense>` con un `ErrorBoundary`.

**D. `iframe onError` no dispara cross-origin.** El fallback de `PdfViewer` depende de `onError`, que no se emite para iframes cross-origin en la mayoría de navegadores modernos. Para un fallback robusto habría que medir con timer o verificar `contentDocument` accesible.

**E. Accesibilidad.** Los `nav-item` del `Sidebar` son `<div onClick>` sin `role="button"`, `tabIndex`, ni soporte de teclado. Lector de pantalla no los anuncia. Idealmente cambiar a `<button>`.

**F. Sincronización Supabase ↔ localStorage.** Hoy es unidireccional (Supabase → local en load, local → Supabase en save). No hay conflict resolution si dos usuarios editan a la vez: gana el último `upsert`. Para trabajo colaborativo, conviene usar `supabase.channel(...)` (Realtime) con optimistic locking (`updated_at`).

**G. `AUTH_PASSWORD` recalculado en cada render.** Mínimo, pero `import.meta.env` es constante — podría moverse fuera del componente.

**H. Archivos `vite.config.js.timestamp-*.mjs` en el workspace.** El sandbox no permite borrarlos desde aquí (permisos), pero el `.gitignore` ahora los excluye. Si `git status` los sigue mostrando, ejecutar:
```
git rm --cached vite.config.js.timestamp-*.mjs .netlify/state.json
```

---

## Verificación

- `npm install` — 146 paquetes, 0 vulnerabilidades reportadas en install.
- `npx vitest run` — **23 tests pasan** (data, plazos, sanitize).
- `npx vite build` — pasa, bundle principal 187 KB (60 KB gzip), lazy chunks por página.

## Archivos modificados

- `.gitignore`
- `README.md`
- `src/App.jsx`
- `src/config/supabase.js`
- `src/pages/RegulationDetail.jsx`
- `src/pages/Normativa.jsx`
- `AUDITORIA_BUGS.md` (nuevo)
