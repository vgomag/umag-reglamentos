# UMAG - Sistema de Seguimiento de Reglamentos

Sistema de seguimiento para la implementación de los nuevos estatutos de la Universidad de Magallanes (DFL 27/2024).

## Características

- Resumen ejecutivo con cuenta regresiva al plazo legal (Art. Primero Transitorio).
- Dashboard con métricas y distribución por estado/prioridad.
- Listado + Kanban de 31 reglamentos precargados.
- Seguimiento de estado (Pendiente, En Proceso, En Revisión, Aprobado).
- Carta Gantt interactiva de 15 meses (Abr 2026 – Jun 2027).
- Carga de PDFs con extracción automática de metadatos (decreto, artículos, plazos).
- Módulo de Normativa: cruza requisitos normativos con reglamentos asociados.
- Persistencia en Supabase (opcional) con fallback automático a localStorage.
- Exportación JSON y autenticación básica por contraseña compartida.

## Tecnologías

- React 18 + Vite 5 (bundler moderno, tree-shaking, lazy loading)
- Supabase JS (CDN) — tabla `regulations` + Storage `reglamentos-pdf`
- pdf.js (CDN) — extracción de texto
- Vitest — tests unitarios
- localStorage + IndexedDB para persistencia local

## Requisitos

- Node.js 18 o superior
- npm 9 o superior

## Desarrollo local

```bash
npm install
cp .env.example .env   # ajustar credenciales
npm run dev
```

## Build de producción

```bash
npm run build           # genera dist/
npm run preview         # prueba dist/ localmente
```

## Tests

```bash
npm test                # corre la suite Vitest
npm run test:watch      # modo watch
```

## Despliegue en Netlify

1. Sube este repositorio a GitHub.
2. Conecta el repo en [Netlify](https://app.netlify.com).
3. Netlify detecta `netlify.toml` y usa:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Configura las variables de entorno en Netlify:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_AUTH_PASSWORD`

## Configuración de Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En el SQL Editor ejecuta el script que aparece comentado en
   [`src/config/supabase.js`](src/config/supabase.js) para crear la tabla
   `regulations` con sus columnas, trigger de `updated_at` y políticas RLS.
3. **IMPORTANTE** — La app NO usa Supabase Auth; las requests viajan con la
   clave anónima (`anon`). Usa las policies "Anon ..." del script. Si usas las
   policies con `auth.role() = 'authenticated'`, la app caerá silenciosamente
   a localStorage.
4. (Opcional) Crea un bucket `reglamentos-pdf` en Storage para almacenar los
   PDFs. Márcalo como público si quieres preview directo.

## Seguridad

- `VITE_AUTH_PASSWORD` se incluye en el bundle cliente: ofrece obfuscación,
  no autenticación real. Para acceso sensible usar Supabase Auth u OIDC.
- La app NUNCA guarda la contraseña en localStorage (versiones anteriores
  sí lo hacían; al abrir la app se limpia automáticamente cualquier valor
  legacy `umag_saved_pass`).
- El anon key de Supabase es público por diseño; la seguridad de datos
  depende de las policies RLS.

## Acceso por defecto

- Usuario: `admin` (editable)
- Contraseña por defecto: `umag2026` (cambiar vía `VITE_AUTH_PASSWORD`)

## Estructura del proyecto

```
src/
├── App.jsx                  # orquestación + login + persistencia
├── main.jsx                 # bootstrap React
├── components/              # Header, Sidebar, PdfViewer, DonutChart, Toast
├── pages/                   # vistas (Dashboard, Normativa, Gantt, etc.)
├── config/
│   ├── data.js              # INITIAL_REGULATIONS + PLAZOS_DATA
│   ├── plazos.js            # fechas límite legales
│   └── supabase.js          # cliente + helpers + SQL de la tabla
└── utils/
    ├── sanitize.js          # sanitización XSS
    └── pdf.js               # extracción de texto con pdf.js
```
