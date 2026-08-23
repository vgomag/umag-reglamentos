# UMAG - Transparencia y Convenios Institucionales

Herramienta de gestión para la Encargada/o de Transparencia y Convenios de la
Universidad de Magallanes. Incluye tres módulos:

1. **Convenios institucionales** — registro, seguimiento por unidad, plazos e historial.
2. **Transparencia pasiva** — solicitudes de acceso a la información (Ley N°20.285)
   con cálculo automático de plazos en días hábiles.
3. **Reglamentos** — el sistema original de seguimiento de los nuevos estatutos
   (DFL 27/2024), que se conserva íntegro.

## Convenios institucionales

- Registro con nombre, unidad de origen, fecha de ingreso, fecha de entrega a
  Rectoría, estado, prioridad y observaciones.
- Listado ordenado por defecto según **orden de llegada** (criterio general de
  atención), con búsqueda y filtros por estado, unidad de origen, unidad actual,
  rango de fechas de ingreso y de entrega, plazo y situación.
- **Seguimiento por unidad** (VRAF · VRAC · VRIIP · VVM · PRO · Contraloría ·
  Rectoría) con fecha de inicio, fecha de término, estado del trámite y
  observaciones por cada una.
- Flujo **adaptable**: cada convenio puede quitar unidades que no participan,
  agregar otras o cambiar el orden. El flujo sugerido es
  `Ingresado → VRAC → VRIIP → VVM → VRAF → PRO → Contraloría → Rectoría → Finalizado`,
  siguiendo el orden de visación de la Res. N°216/2019: primero la vicerrectoría
  temática que corresponda al objeto del convenio y después VRAF, que visa
  cuando compromete recursos.
- **Plazos opcionales**: no hay plazo general; sólo los convenios con fecha
  límite se destacan con semáforo 🟢 en plazo · 🟡 próximo a vencer ·
  🔴 vencido · 🔵 sin plazo especial · ⚫ finalizado.
- **Historial automático**: cada cambio de estado, derivación, recepción,
  término de etapa, cambio de plazo, entrega a Rectoría y finalización queda
  registrado con fecha, hora y usuario.
- Dashboard con totales, ingresos recientes, en trámite, pendientes de Rectoría,
  finalizados, con plazo especial, próximos a vencer, vencidos y carga por unidad.
- Tablero de seguimiento tipo kanban por unidad, con días de permanencia.
- Calendario mensual, exportación `.ics` y enlaces "Agregar a Google Calendar".
- Reportes agregados y exportación a CSV/JSON.

## Datos de ejemplo

La aplicación **arranca vacía**. Para recorrerla con algo que mirar, en
**Configuración → Datos de ejemplo** hay un botón que carga 8 convenios y 4
solicitudes ficticios que cubren todos los estados del semáforo y todas las
ubicaciones del flujo (uno vencido, uno próximo a vencer, uno recién ingresado,
uno pendiente de Rectoría, uno finalizado, una solicitud prorrogada, etc.).

- Se identifican por el prefijo `EJ-` en su código y por un aviso en sus
  observaciones, así que no se confunden con registros reales.
- Sus fechas se calculan **respecto del día de carga**, de modo que los ejemplos
  no envejecen ni quedan todos vencidos con el tiempo.
- El botón *Quitar datos de ejemplo* los elimina sin tocar los convenios y
  solicitudes que hayas registrado.

## Transparencia pasiva (Ley N°20.285)

- Registro de solicitudes de acceso a la información con los campos del acuse de
  recibo del Portal de Transparencia (código, solicitante, materia, vía de
  ingreso, formato y medio de entrega).
- **Plazos legales calculados en días hábiles**, sin digitación manual:
  respuesta 20 días (Art. 14), prórroga +10 días (Art. 14 inc. 2°), subsanación
  5 días (Art. 12), notificación a terceros 2 días y oposición 3 días (Art. 20),
  amparo ante el CPLT 15 días (Art. 24).
- Los días hábiles excluyen sábados, domingos y festivos (Ley 19.880 art. 25).
  El calendario de feriados está en [`src/config/feriados.js`](src/config/feriados.js)
  y **debe revisarse cada año**: los feriados movibles y los de elecciones cambian.

## Reglamentos (módulo original, sin cambios)

- Resumen ejecutivo con cuenta regresiva al plazo legal (Art. Primero Transitorio).
- Dashboard con métricas y distribución por estado/prioridad.
- Listado + Kanban de 31 reglamentos precargados.
- Seguimiento de estado (Pendiente, En Proceso, En Revisión, Aprobado).
- Carta Gantt interactiva de 15 meses (Abr 2026 – Jun 2027).
- Carga de PDFs con extracción automática de metadatos (decreto, artículos, plazos).
- Módulo de Normativa: cruza requisitos normativos con reglamentos asociados.
- Persistencia en Supabase (opcional) con fallback automático a localStorage.
- Exportación JSON y autenticación básica por contraseña compartida.

## Integración con Google Calendar

| Capacidad | Estado |
|---|---|
| Exportación `.ics` de convenios y solicitudes | ✅ Disponible |
| Enlace "Agregar a Google Calendar" por evento | ✅ Disponible |
| Sincronización automática con la API | ⬜ Pendiente de credenciales y adaptador |

Las fechas de ingreso, límite, entrega a Rectoría y término de etapas ya se
derivan como eventos de calendario con un identificador estable
(`umag-convenios-convenio-<id>-<clave>`), pensado para hacer *upsert* idempotente
contra la Google Calendar API sin duplicar eventos.

Para habilitar la sincronización automática:

1. Define `VITE_GOOGLE_CLIENT_ID` y `VITE_GOOGLE_CALENDAR_ID`.
2. Implementa un adaptador con los métodos `conectar()` y `sincronizar(eventos)`
   descritos en [`src/utils/googleCalendar.js`](src/utils/googleCalendar.js) y
   pásalo a `crearSincronizador()`.

La UI ya trabaja contra esa interfaz, así que no hay que modificar las vistas.

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
   - `VITE_GOOGLE_CLIENT_ID` y `VITE_GOOGLE_CALENDAR_ID` (opcionales)

## Configuración de Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En el SQL Editor ejecuta los scripts que aparecen comentados en:
   - [`src/config/supabase.js`](src/config/supabase.js) → tabla `regulations`
   - [`src/config/conveniosStore.js`](src/config/conveniosStore.js) → tabla `convenios`
   - [`src/config/transparenciaStore.js`](src/config/transparenciaStore.js) → tabla `solicitudes_transparencia`

   Incluyen columnas, trigger de `updated_at` y políticas RLS.

   Si no configuras Supabase, la aplicación funciona igual guardando todo en
   `localStorage` de ese navegador.
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
- ⚠️ Las solicitudes de transparencia contienen **datos personales** del
  solicitante (nombre, correo, teléfono). Si se almacenan en Supabase, conviene
  migrar a Supabase Auth real (Opción B del script) en vez de la anon key.

## Acceso por defecto

- Usuario: `admin` (editable)
- Contraseña por defecto: `umag2026` (cambiar vía `VITE_AUTH_PASSWORD`)

## Estructura del proyecto

```
src/
├── App.jsx                        # orquestación + login + persistencia
├── main.jsx                       # bootstrap React
├── components/
│   ├── Header.jsx, Sidebar.jsx, Toast.jsx, DonutChart.jsx, PdfViewer.jsx
│   ├── PlazoBadge.jsx             # semáforo de plazos
│   ├── FlujoEtapas.jsx            # línea Ingresado → … → Finalizado
│   └── HistorialTimeline.jsx      # historial cronológico
├── pages/
│   ├── ConveniosDashboard.jsx     # panel principal de convenios
│   ├── ConveniosList.jsx          # listado con búsqueda, filtros y orden
│   ├── ConvenioDetail.jsx         # ficha: datos, etapas, plazos, historial
│   ├── NuevoConvenio.jsx          # alta de convenio
│   ├── SeguimientoView.jsx        # tablero por unidad
│   ├── CalendarioView.jsx         # calendario mensual + exportación
│   ├── TransparenciaView.jsx      # solicitudes Ley 20.285
│   ├── ReportesView.jsx           # reportes agregados y CSV/JSON
│   ├── ConfiguracionView.jsx      # reglas, almacenamiento, respaldos
│   └── (Dashboard, Normativa, Gantt, … del módulo de Reglamentos)
├── config/
│   ├── data.js                    # INITIAL_REGULATIONS + PLAZOS_DATA
│   ├── plazos.js                  # fechas límite legales del estatuto
│   ├── feriados.js                # feriados de Chile (revisar cada año)
│   ├── datosEjemplo.js            # convenios y solicitudes de demostración
│   ├── convenios.js               # unidades, estados, flujo, semáforo
│   ├── conveniosStore.js          # persistencia de convenios + SQL
│   ├── transparencia.js           # plazos y estados de la Ley 20.285
│   ├── transparenciaStore.js      # persistencia de solicitudes + SQL
│   └── supabase.js                # cliente + helpers + SQL de `regulations`
└── utils/
    ├── fechas.js                  # fechas ISO y días hábiles administrativos
    ├── conveniosLogic.js          # semáforo, ubicación, filtros, historial
    ├── transparenciaLogic.js      # plazos legales de las solicitudes
    ├── googleCalendar.js          # eventos, .ics y contrato de sincronización
    ├── sanitize.js                # sanitización XSS
    └── pdf.js                     # extracción de texto con pdf.js
```

## Decisiones y supuestos

- **Sin plazo general para convenios**: la cola se trabaja por orden de llegada.
  Sólo los convenios con fecha límite explícita entran al semáforo de alertas.
  El umbral de "próximo a vencer" (7 días corridos) está en `DIAS_ALERTA_VENCIMIENTO`.
- **Flujo no rígido**: el orden de unidades vive en cada convenio, no en una
  constante global, para que se pueda alterar convenio por convenio.
- **Feriados**: la tabla de `src/config/feriados.js` cubre 2025-2027 y debe
  actualizarse cada año; afecta directamente el cálculo de los plazos legales.
- **Módulo de Reglamentos intacto**: no se eliminó ninguna vista ni dato del
  sistema original; quedó agrupado en su propia sección del menú.
