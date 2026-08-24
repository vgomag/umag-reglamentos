# UMAG - Transparencia

Herramienta de gestión para la Encargada/o de Transparencia y Convenios de la
Universidad de Magallanes. Tiene dos módulos:

1. **Convenios institucionales** — registro, seguimiento por unidad, plazos e historial.
2. **Transparencia pasiva** — solicitudes de acceso a la información (Ley N°20.285)
   con cálculo automático de plazos en días hábiles.

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
- Google Sheets vía Apps Script — convenios y solicitudes
- Vitest — tests unitarios
- localStorage como respaldo

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
   - `VITE_GOOGLE_CLIENT_ID` (inicio de sesión)
   - `VITE_SHEETS_API_URL` y `VITE_SHEETS_TOKEN` (planilla de Google)
   - `VITE_SHEET_URL` y `VITE_DRIVE_FOLDER_URL` (opcionales, sólo enlaces)
   - `VITE_GOOGLE_CALENDAR_ID` (opcional)

## Quién puede entrar

El acceso es con **cuenta de Google**, restringido a una lista de correos
autorizados. No hay contraseñas ni roles: quien está en la lista tiene acceso
completo.

```
Navegador ──"Entrar con Google"──▶ Google emite un ID token firmado
    │
    └──cada petición lleva el token──▶ Apps Script lo verifica contra Google
                                       y comprueba la lista de autorizados
```

**La lista vive en el Apps Script**, en la constante `USUARIOS_AUTORIZADOS`.
Eso es lo que hace que la restricción sea real: alguien que edite el JavaScript
del navegador puede saltarse la pantalla de acceso, pero no va a conseguir que
la planilla le responda, porque quien decide es el script.

### Dar de alta a una persona

1. Abre la planilla → **Extensiones → Apps Script**.
2. Agrega su correo a `USUARIOS_AUTORIZADOS`.
3. **Implementar → Gestionar implementaciones → ✏️ → Versión: Nueva versión**.

Dar de baja es lo mismo, borrando la línea. Surte efecto en unos cinco minutos
(el script guarda en caché la verificación durante ese tiempo).

No hace falta compartirle la planilla ni la carpeta de Drive: el script entra a
ambas con la cuenta de quien lo publicó. Compartírselas sólo sirve si además
quieres que pueda abrir el Sheet directamente.

### Crear el ID de cliente OAuth

Una sola vez, en [Google Cloud Console](https://console.cloud.google.com):

1. Crea un proyecto.
2. **APIs y servicios → Pantalla de consentimiento de OAuth**: tipo *Externo*,
   completa nombre y correo de contacto.
3. **Credenciales → Crear credenciales → ID de cliente de OAuth** → tipo
   *Aplicación web*.
4. En **Orígenes autorizados de JavaScript** agrega la URL del sitio, sin barra
   final (por ejemplo `https://umag-transparencia.netlify.app`). Para trabajar
   en local agrega también `http://localhost:5173`.
5. Copia el **ID de cliente** y ponlo en dos lugares: `VITE_GOOGLE_CLIENT_ID`
   en Netlify y `CLIENT_ID` en el Apps Script. Tienen que coincidir.

> Mientras la pantalla de consentimiento esté en modo *Prueba*, sólo entran las
> cuentas que agregues como usuarios de prueba. Publicarla quita ese límite;
> igual manda la lista del script.

## Dónde viven los datos

| Módulo | Almacén | Respaldo |
|---|---|---|
| Convenios | Google Sheets | `localStorage` |
| Transparencia | Google Sheets | `localStorage` |

Todo vive en una planilla de Google a la que la app accede a través de un Apps
Script publicado desde la propia planilla: no hace falta proyecto en Google
Cloud para los datos ni cuenta de servicio. El único trámite en Google Cloud es
el ID de cliente OAuth del inicio de sesión (ver más arriba).

```
Navegador (Netlify)  ──HTTP──▶  Apps Script (/exec)  ──▶  Google Sheets
        │
        └── localStorage (copia local, permite trabajar si la planilla falla)
```

### Puesta en marcha de la planilla

1. Abre la planilla → **Extensiones → Apps Script**.
2. Reemplaza `Código.gs` por [`google-apps-script/Codigo.gs`](google-apps-script/Codigo.gs).
3. Cambia tres constantes: `TOKEN` (cadena larga y aleatoria),
   `USUARIOS_AUTORIZADOS` (los correos que pueden entrar) y `CLIENT_ID`
   (el ID de cliente OAuth).
4. Ejecuta una vez la función `prepararPlanilla` para crear las hojas
   `Convenios`, `Solicitudes` e `Historial` con sus encabezados.
5. **Implementar → Nueva implementación → Aplicación web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**

   Copia la URL que termina en `/exec`.
6. En Netlify define `VITE_SHEETS_API_URL` (esa URL), `VITE_SHEETS_TOKEN`
   (el mismo TOKEN del paso 3) y `VITE_GOOGLE_CLIENT_ID` (el mismo CLIENT_ID).
   Opcionalmente `VITE_SHEET_URL` y `VITE_DRIVE_FOLDER_URL` para que
   Configuración muestre los enlaces.

   ⚠ Vite congela estas variables al compilar: después de agregarlas hay que
   **volver a desplegar** (Deploys → Trigger deploy).
7. Entra a **Configuración → Comprobar conexión** para verificarlo.

> Si al comprobar aparece *"La respuesta no es JSON"*, casi siempre es que la
> implementación no quedó con acceso "Cualquier usuario", o que se publicó una
> versión nueva sin actualizar la URL.

### Cómo se guarda en la planilla

- **Convenios**: una fila por convenio. Las etapas van en columnas planas
  (`VRAC_inicio`, `VRAC_estado`, …) en vez de JSON, para que la planilla siga
  siendo legible y editable a mano. Una unidad sin ningún dato se entiende como
  que no participa en ese convenio.
- **Historial**: una fila por evento, en su propia hoja. Es append-only.
- **Solicitudes**: una fila por solicitud de acceso a la información.

Se puede editar la planilla a mano; la app lee esos cambios en la siguiente
carga. Lo que no conviene es alterar los encabezados ni la columna `id`.

### Documentos adjuntos

La carpeta de Drive asociada guarda los PDFs y documentos de cada convenio. Hoy
se enlazan a mano desde el campo de enlace del convenio; la subida directa desde
la app queda pendiente.

## Seguridad

- El control de acceso está en `USUARIOS_AUTORIZADOS`, dentro del Apps Script.
  Es server-side: no se puede saltar editando el navegador.
- El ID de cliente OAuth es público por diseño; no es un secreto.
- La sesión se guarda en `sessionStorage` y caduca con el token de Google
  (una hora). Se cierra al cerrar la pestaña.
- La app ya no usa contraseña compartida. Al abrirla se limpian
  automáticamente los restos que dejaron las versiones anteriores.
- `VITE_SHEETS_API_URL` y `VITE_SHEETS_TOKEN` viajan en el bundle del cliente,
  así que no son secretos. **Pero ya no bastan para entrar**: desde que existe
  el inicio de sesión con Google, cada petición tiene que traer además un ID
  token válido de una cuenta autorizada. Quien consiga la URL y el token, sin
  una cuenta de la lista, no lee ni escribe nada.
- ⚠️ Las solicitudes de transparencia contienen **datos personales** del
  solicitante (nombre, correo, teléfono). Viajan al navegador de quien esté
  autorizado y quedan en su `localStorage` como respaldo; conviene no usar la
  app en equipos compartidos.
- La planilla y la carpeta de Drive se comparten con los permisos de Google:
  revisa quién tiene acceso antes de cargar datos reales.

## Estructura del proyecto

```
src/
├── App.jsx                        # orquestación + login + persistencia
├── main.jsx                       # bootstrap React
├── components/
│   ├── Header.jsx, Sidebar.jsx, Toast.jsx
│   ├── PlazoBadge.jsx             # semáforo de plazos
│   ├── FlujoEtapas.jsx            # línea Ingresado → … → Finalizado
│   └── HistorialTimeline.jsx      # historial cronológico
├── pages/
│   ├── ConveniosDashboard.jsx     # panel principal
│   ├── ConveniosList.jsx          # listado con búsqueda, filtros y orden
│   ├── ConvenioDetail.jsx         # ficha: datos, etapas, plazos, historial
│   ├── NuevoConvenio.jsx          # alta de convenio
│   ├── SeguimientoView.jsx        # tablero por unidad
│   ├── CalendarioView.jsx         # calendario mensual + exportación
│   ├── TransparenciaView.jsx      # solicitudes Ley 20.285
│   ├── ReportesView.jsx           # reportes agregados y CSV/JSON
│   └── ConfiguracionView.jsx      # reglas, almacenamiento, respaldos
├── config/
│   ├── auth.js                    # inicio de sesión con Google
│   ├── convenios.js               # unidades, estados, flujo, semáforo
│   ├── transparencia.js           # plazos y estados de la Ley 20.285
│   ├── feriados.js                # feriados de Chile (revisar cada año)
│   ├── datosEjemplo.js            # convenios y solicitudes de demostración
│   ├── sheetsStore.js             # cliente del Apps Script (Google Sheets)
│   ├── conveniosStore.js          # respaldo local de convenios
│   └── transparenciaStore.js      # respaldo local de solicitudes
└── utils/
    ├── fechas.js                  # fechas ISO y días hábiles administrativos
    ├── conveniosLogic.js          # semáforo, ubicación, filtros, historial
    ├── transparenciaLogic.js      # plazos legales de las solicitudes
    ├── googleCalendar.js          # eventos, .ics y contrato de sincronización
    └── sanitize.js                # sanitización XSS

google-apps-script/
└── Codigo.gs                      # backend en la planilla de Google
```

## Decisiones y supuestos

- **Sin plazo general para convenios**: la cola se trabaja por orden de llegada.
  Sólo los convenios con fecha límite explícita entran al semáforo de alertas.
  El umbral de "próximo a vencer" (7 días corridos) está en `DIAS_ALERTA_VENCIMIENTO`.
- **Flujo no rígido**: el orden de unidades vive en cada convenio, no en una
  constante global, para que se pueda alterar convenio por convenio.
- **Feriados**: la tabla de `src/config/feriados.js` cubre 2025-2027 y debe
  actualizarse cada año; afecta directamente el cálculo de los plazos legales.
- **Escrituras secuenciales**: al cargar datos de ejemplo, la app envía los
  registros de a uno. El Apps Script asigna los `id` leyendo el máximo actual,
  así que en paralelo se pisarían entre sí.
