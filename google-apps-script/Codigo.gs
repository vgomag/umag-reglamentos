/**
 * Backend de "UMAG · Transparencia" sobre Google Sheets.
 *
 * Este script vive DENTRO de la planilla y se publica como aplicación web.
 * La app (sitio estático en Netlify) le habla por HTTP; no hay servidor propio,
 * ni proyecto en Google Cloud, ni cuenta de servicio.
 *
 * ── Instalación ────────────────────────────────────────────────────────
 * 1. Abre la planilla → Extensiones → Apps Script.
 * 2. Reemplaza el contenido de Código.gs por este archivo y guarda.
 * 3. Edita abajo: TOKEN (cadena larga y aleatoria), USUARIOS_AUTORIZADOS
 *    (los correos que pueden entrar) y CLIENT_ID (el ID de cliente OAuth).
 * 4. Implementar → Nueva implementación → Aplicación web:
 *      - Ejecutar como: Yo
 *      - Quién tiene acceso: Cualquier usuario
 *    Copia la URL que termina en /exec.
 * 5. En Netlify define las variables de entorno:
 *      VITE_SHEETS_API_URL = la URL /exec
 *      VITE_SHEETS_TOKEN   = el mismo TOKEN de abajo
 *
 * ⚠ "Cualquier usuario" significa que quien conozca la URL puede llamarla. Por
 * eso el control de acceso real NO está en la URL ni en el TOKEN —ambos viajan
 * en el bundle del navegador— sino en USUARIOS_AUTORIZADOS: cada petición trae
 * un ID token firmado por Google que este script verifica antes de responder.
 * Sin una cuenta de la lista no se lee ni se escribe nada.
 *
 * ── Cómo guarda los datos ─────────────────────────────────────────────
 * Las etapas de cada convenio se guardan en columnas planas (VRAC_inicio,
 * VRAC_estado, …) en vez de como JSON, para que la planilla siga siendo
 * legible y editable a mano. El historial va en su propia hoja, una fila por
 * evento, que es la forma natural de un registro cronológico.
 */

// ── VERSIÓN DE ESTE ARCHIVO ──────────────────────────────────────────
//
// Guardar el código en el editor NO actualiza la aplicación web: hay que
// publicar una versión nueva. Son dos pasos separados y es fácil hacer sólo el
// primero, con lo que el editor muestra el código nuevo mientras la planilla
// sigue respondiendo con el viejo, sin ninguna señal.
//
// Este número viaja en cada respuesta para que la app pueda comparar lo que
// hay publicado con lo que espera el repositorio. Configuración → Comprobar
// conexión lo muestra y avisa si no coinciden.
//
// ⚠ SÚBELO CADA VEZ que cambies algo de este archivo. Hay una prueba
// (src/config/versionScript.test.js) que falla si te olvidas de subir también
// VERSION_SCRIPT_ESPERADA en src/config/versionScript.js.
var VERSION_SCRIPT = '2';

var TOKEN = 'CAMBIA-ESTE-TOKEN-POR-UNO-LARGO-Y-ALEATORIO';

// ── QUIÉN PUEDE ENTRAR ───────────────────────────────────────────────
//
// Escribe aquí los correos de Google autorizados, en minúsculas. Quien no esté
// en esta lista no puede leer ni escribir nada, aunque conozca la URL y el
// TOKEN. No hay roles: todos los de la lista tienen acceso completo.
//
// Para dar de baja a alguien, borra su línea y vuelve a implementar
// (Implementar → Gestionar implementaciones → ✏️ → Versión: Nueva versión).
var USUARIOS_AUTORIZADOS = [
  'tu-correo@gmail.com',
  'correo-de-camilo@gmail.com',
];

// ID de cliente OAuth creado en Google Cloud Console. Tiene que ser EL MISMO
// que VITE_GOOGLE_CLIENT_ID en Netlify: el script comprueba que el token venga
// de esta aplicación y no de otra cualquiera.
var CLIENT_ID = 'PEGA-AQUI-TU-ID-DE-CLIENTE.apps.googleusercontent.com';

// Orden del flujo sugerido (Res. N°216/2019). Debe coincidir con
// FLUJO_POR_DEFECTO de src/config/convenios.js.
var UNIDADES = ['VRAC', 'VRIIP', 'VVM', 'VRAF', 'PRO', 'CONTRALORIA', 'RECTORIA'];

var HOJA_CONVENIOS = 'Convenios';
var HOJA_SOLICITUDES = 'Solicitudes';
var HOJA_HISTORIAL = 'Historial';

var CAMPOS_CONVENIO = [
  ['id', 'id'], ['codigo', 'codigo'], ['nombre', 'nombre'],
  ['unidad_origen', 'unidadOrigen'], ['contraparte', 'contraparte'], ['tipo', 'tipo'],
  ['fecha_ingreso', 'fechaIngreso'], ['fecha_limite', 'fechaLimite'],
  ['plazo_especial', 'plazoEspecial'], ['prioridad', 'prioridad'],
  ['motivo_prioridad', 'motivoPrioridad'], ['estado', 'estado'],
  ['fecha_entrega_rectoria', 'fechaEntregaRectoria'], ['observaciones', 'observaciones'],
];

var CAMPOS_SOLICITUD = [
  ['id', 'id'], ['codigo', 'codigo'], ['fecha_ingreso', 'fechaIngreso'],
  ['solicitante', 'solicitante'], ['tipo_persona', 'tipoPersona'], ['email', 'email'],
  ['telefono', 'telefono'], ['via_ingreso', 'viaIngreso'], ['materia', 'materia'],
  ['unidad_derivada', 'unidadDerivada'], ['etapa', 'etapa'], ['estado', 'estado'],
  ['prorrogada', 'prorrogada'], ['fecha_prorroga', 'fechaProrroga'],
  ['subsanacion_solicitada', 'subsanacionSolicitada'], ['fecha_subsanacion', 'fechaSubsanacion'],
  ['tercero_involucrado', 'terceroInvolucrado'], ['fecha_respuesta', 'fechaRespuesta'],
  ['causal_reserva', 'causalReserva'], ['formato_entrega', 'formatoEntrega'],
  ['medio_envio', 'medioEnvio'], ['observaciones', 'observaciones'],
];

var CAMPOS_HISTORIAL = ['entidad', 'ref_id', 'evento_id', 'fecha', 'tipo', 'descripcion', 'usuario'];

/* ── Encabezados ──────────────────────────────────────────────────── */

function encabezadosConvenios() {
  var cols = CAMPOS_CONVENIO.map(function (c) { return c[0]; });
  UNIDADES.forEach(function (u) {
    // `_orden` guarda la posición de la unidad EN ESTE convenio. Sin ella, el
    // flujo volvía siempre en el orden fijo de UNIDADES y se perdía el que
    // hubiera armado la ficha (reglas de negocio N°5 y N°6).
    cols.push(u + '_inicio', u + '_termino', u + '_estado', u + '_observaciones', u + '_orden');
  });
  cols.push('actualizado');
  return cols;
}

function encabezadosSolicitudes() {
  return CAMPOS_SOLICITUD.map(function (c) { return c[0]; }).concat(['actualizado']);
}

/**
 * Agrega a la derecha los encabezados que la hoja todavía no tiene.
 *
 * Cuando el script gana una columna, las planillas que ya existen se quedan sin
 * ella y el dato se pierde en silencio. Las nuevas se agregan AL FINAL y nunca
 * se mueven ni se renombran las que ya están: las filas viejas quedan intactas
 * y sólo estrenan celdas vacías.
 *
 * Que la columna nueva no quede junto a las de su unidad es feo pero da igual:
 * el script mapea por NOMBRE de encabezado, no por posición.
 */
function migrarEncabezados(h, esperados) {
  var ancho = h.getLastColumn();
  if (ancho === 0) return esperados;
  var actuales = h.getRange(1, 1, 1, ancho).getValues()[0].map(function (c) { return String(c).trim(); });

  var faltantes = esperados.filter(function (e) { return actuales.indexOf(e) === -1; });
  if (faltantes.length === 0) return actuales;

  h.getRange(1, ancho + 1, 1, faltantes.length).setValues([faltantes]);
  h.getRange(1, ancho + 1, 1, faltantes.length).setFontWeight('bold');
  return actuales.concat(faltantes);
}

// Devuelve la hoja pedida, creándola con sus encabezados si no existe y
// completándolos si le faltan columnas de una versión anterior del script.
function hoja(nombre) {
  var libro = SpreadsheetApp.getActiveSpreadsheet();
  var h = libro.getSheetByName(nombre);
  var encabezados = nombre === HOJA_CONVENIOS ? encabezadosConvenios()
    : nombre === HOJA_SOLICITUDES ? encabezadosSolicitudes()
      : CAMPOS_HISTORIAL;
  if (!h) {
    h = libro.insertSheet(nombre);
    h.getRange(1, 1, 1, encabezados.length).setValues([encabezados]);
    h.setFrozenRows(1);
    h.getRange(1, 1, 1, encabezados.length).setFontWeight('bold');
  } else if (h.getLastRow() === 0) {
    h.getRange(1, 1, 1, encabezados.length).setValues([encabezados]);
    h.setFrozenRows(1);
  } else {
    migrarEncabezados(h, encabezados);
  }
  return h;
}

/* ── Conversión fila ↔ objeto ───────────────────────────────────────── */

// Las celdas de fecha pueden volver como Date; el dominio usa "YYYY-MM-DD".
function aTexto(valor) {
  if (valor === null || valor === undefined) return '';
  if (Object.prototype.toString.call(valor) === '[object Date]') {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(valor).trim();
}

function aBooleano(valor) {
  if (typeof valor === 'boolean') return valor;
  var t = aTexto(valor).toLowerCase();
  return t === 'true' || t === 'verdadero' || t === 'sí' || t === 'si' || t === '1';
}

function filaAConvenio(fila, encabezados) {
  var obj = {};
  var idx = {};
  encabezados.forEach(function (h, i) { idx[h] = i; });

  CAMPOS_CONVENIO.forEach(function (c) {
    obj[c[1]] = aTexto(fila[idx[c[0]]]);
  });
  obj.id = Number(obj.id) || null;
  obj.plazoEspecial = aBooleano(fila[idx.plazo_especial]);

  obj.etapas = [];
  UNIDADES.forEach(function (u, posicionPorDefecto) {
    var estado = aTexto(fila[idx[u + '_estado']]);
    var inicio = aTexto(fila[idx[u + '_inicio']]);
    var termino = aTexto(fila[idx[u + '_termino']]);
    var obs = aTexto(fila[idx[u + '_observaciones']]);
    // Una unidad sin ningún dato no participa en este convenio. `_orden` no
    // cuenta para decidirlo: si contara, una unidad quitada del flujo podría
    // revivir por un orden que quedó suelto.
    if (!estado && !inicio && !termino && !obs) return;

    // Filas anteriores a la columna `_orden` no la traen: ahí se cae al orden
    // fijo del flujo, que es lo que la app hacía siempre hasta ahora.
    var guardado = Number(aTexto(fila[idx[u + '_orden']]));
    var orden = isNaN(guardado) || aTexto(fila[idx[u + '_orden']]) === ''
      ? posicionPorDefecto
      : guardado;

    obj.etapas.push({
      unidad: u, orden: orden,
      fechaInicio: inicio, fechaTermino: termino,
      estado: estado || 'Pendiente', observaciones: obs,
    });
  });
  obj.etapas.sort(function (a, b) { return a.orden - b.orden; });

  obj.historial = [];
  obj.adjuntos = [];
  return obj;
}

function convenioAFila(c, encabezados) {
  var porUnidad = {};
  (c.etapas || []).forEach(function (e) { porUnidad[e.unidad] = e; });

  return encabezados.map(function (h) {
    var campo = null;
    for (var i = 0; i < CAMPOS_CONVENIO.length; i++) {
      if (CAMPOS_CONVENIO[i][0] === h) { campo = CAMPOS_CONVENIO[i][1]; break; }
    }
    if (campo) return c[campo] === undefined || c[campo] === null ? '' : c[campo];
    if (h === 'actualizado') return new Date();

    var partes = h.split('_');
    var sufijo = partes.pop();
    var unidad = partes.join('_');
    var etapa = porUnidad[unidad];
    if (!etapa) return '';
    if (sufijo === 'inicio') return etapa.fechaInicio || '';
    if (sufijo === 'termino') return etapa.fechaTermino || '';
    if (sufijo === 'estado') return etapa.estado || '';
    if (sufijo === 'observaciones') return etapa.observaciones || '';
    // El 0 es un orden válido (la primera unidad del flujo), así que no vale
    // el `|| ''` de los demás campos.
    if (sufijo === 'orden') return typeof etapa.orden === 'number' ? etapa.orden : '';
    return '';
  });
}

function filaASolicitud(fila, encabezados) {
  var idx = {};
  encabezados.forEach(function (h, i) { idx[h] = i; });
  var obj = {};
  CAMPOS_SOLICITUD.forEach(function (c) { obj[c[1]] = aTexto(fila[idx[c[0]]]); });
  obj.id = Number(obj.id) || null;
  obj.prorrogada = aBooleano(fila[idx.prorrogada]);
  obj.subsanacionSolicitada = aBooleano(fila[idx.subsanacion_solicitada]);
  obj.terceroInvolucrado = aBooleano(fila[idx.tercero_involucrado]);
  obj.historial = [];
  return obj;
}

function solicitudAFila(s, encabezados) {
  return encabezados.map(function (h) {
    if (h === 'actualizado') return new Date();
    for (var i = 0; i < CAMPOS_SOLICITUD.length; i++) {
      if (CAMPOS_SOLICITUD[i][0] === h) {
        var v = s[CAMPOS_SOLICITUD[i][1]];
        return v === undefined || v === null ? '' : v;
      }
    }
    return '';
  });
}

/* ── Lectura ──────────────────────────────────────────────────────── */

function leerHoja(nombre) {
  var h = hoja(nombre);
  var ultima = h.getLastRow();
  if (ultima < 2) return { encabezados: h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0], filas: [] };
  var ancho = h.getLastColumn();
  return {
    encabezados: h.getRange(1, 1, 1, ancho).getValues()[0],
    filas: h.getRange(2, 1, ultima - 1, ancho).getValues(),
  };
}

// Agrupa el historial por entidad y id de referencia.
function historialAgrupado() {
  var datos = leerHoja(HOJA_HISTORIAL);
  var idx = {};
  datos.encabezados.forEach(function (h, i) { idx[h] = i; });
  var mapa = {};
  datos.filas.forEach(function (f) {
    var clave = aTexto(f[idx.entidad]) + ':' + aTexto(f[idx.ref_id]);
    if (!mapa[clave]) mapa[clave] = [];
    mapa[clave].push({
      id: aTexto(f[idx.evento_id]),
      fecha: aTexto(f[idx.fecha]),
      tipo: aTexto(f[idx.tipo]),
      descripcion: aTexto(f[idx.descripcion]),
      usuario: aTexto(f[idx.usuario]),
    });
  });
  return mapa;
}

function listarTodo() {
  var historial = historialAgrupado();

  var dc = leerHoja(HOJA_CONVENIOS);
  var convenios = dc.filas
    .filter(function (f) { return aTexto(f[0]) !== ''; })
    .map(function (f) {
      var c = filaAConvenio(f, dc.encabezados);
      c.historial = historial['convenio:' + c.id] || [];
      return c;
    });

  var ds = leerHoja(HOJA_SOLICITUDES);
  var solicitudes = ds.filas
    .filter(function (f) { return aTexto(f[0]) !== ''; })
    .map(function (f) {
      var s = filaASolicitud(f, ds.encabezados);
      s.historial = historial['solicitud:' + s.id] || [];
      return s;
    });

  return { convenios: convenios, solicitudes: solicitudes };
}

/* ── Escritura ─────────────────────────────────────────────────── */

function buscarFila(nombreHoja, id) {
  var datos = leerHoja(nombreHoja);
  for (var i = 0; i < datos.filas.length; i++) {
    if (Number(datos.filas[i][0]) === Number(id)) return i + 2; // +2: encabezado y base 1
  }
  return -1;
}

/**
 * Id nuevo para una hoja. El contador es MONOTÓNICO: nunca vuelve atrás,
 * aunque se borren filas.
 *
 * Con el máximo de la hoja + 1 bastaría si nadie borrara nada, pero al borrar
 * el registro de id más alto ese id quedaba libre y el siguiente que se creara
 * lo reutilizaba, heredando el historial del borrado (que se agrupa por
 * "entidad:id"). Por eso el último id entregado se recuerda aparte.
 *
 * Se toma el mayor entre lo recordado y lo que hay en la hoja, para que el
 * contador siga siendo correcto en planillas anteriores a este cambio y si
 * alguien agrega filas a mano.
 */
function siguienteId(nombreHoja) {
  var datos = leerHoja(nombreHoja);
  var max = 0;
  datos.filas.forEach(function (f) { max = Math.max(max, Number(f[0]) || 0); });

  var props = PropertiesService.getScriptProperties();
  var clave = 'ultimo_id_' + nombreHoja;
  var recordado = Number(props.getProperty(clave)) || 0;

  var siguiente = Math.max(max, recordado) + 1;
  props.setProperty(clave, String(siguiente));
  return siguiente;
}

function guardarHistorial(entidad, refId, eventos) {
  if (!eventos || eventos.length === 0) return;
  var h = hoja(HOJA_HISTORIAL);
  var datos = leerHoja(HOJA_HISTORIAL);
  var idx = {};
  datos.encabezados.forEach(function (c, i) { idx[c] = i; });

  // Sólo se agregan los eventos que aún no están: el historial es append-only.
  var existentes = {};
  datos.filas.forEach(function (f) {
    if (aTexto(f[idx.entidad]) === entidad && String(f[idx.ref_id]) === String(refId)) {
      existentes[aTexto(f[idx.evento_id])] = true;
    }
  });

  var nuevas = eventos
    .filter(function (ev) { return ev && ev.id && !existentes[String(ev.id)]; })
    .map(function (ev) {
      return [entidad, refId, ev.id, ev.fecha || '', ev.tipo || '', ev.descripcion || '', ev.usuario || ''];
    });
  if (nuevas.length > 0) {
    h.getRange(h.getLastRow() + 1, 1, nuevas.length, CAMPOS_HISTORIAL.length).setValues(nuevas);
  }
}

/**
 * Borra las filas de historial de un registro.
 *
 * El historial es append-only mientras el registro existe, pero cuando el
 * convenio o la solicitud se elimina hay que llevarse su rastro: si quedara
 * huérfano, seguiría apareciendo bajo la clave "entidad:id" y se lo encontraría
 * cualquier registro que llegara a ocupar ese id. Además, el historial de una
 * solicitud contiene datos del solicitante que no deben sobrevivir al borrado.
 */
function eliminarHistorial(entidad, refId) {
  var h = hoja(HOJA_HISTORIAL);
  var datos = leerHoja(HOJA_HISTORIAL);
  var idx = {};
  datos.encabezados.forEach(function (c, i) { idx[c] = i; });

  // De abajo hacia arriba: borrar una fila desplaza a todas las de abajo.
  for (var i = datos.filas.length - 1; i >= 0; i--) {
    var f = datos.filas[i];
    if (aTexto(f[idx.entidad]) === entidad && String(f[idx.ref_id]) === String(refId)) {
      h.deleteRow(i + 2); // +2: encabezado y base 1
    }
  }
}

function crearConvenio(datos) {
  var h = hoja(HOJA_CONVENIOS);
  var encabezados = leerHoja(HOJA_CONVENIOS).encabezados;
  datos.id = siguienteId(HOJA_CONVENIOS);
  h.appendRow(convenioAFila(datos, encabezados));
  guardarHistorial('convenio', datos.id, datos.historial);
  return datos;
}

function actualizarConvenio(datos) {
  var fila = buscarFila(HOJA_CONVENIOS, datos.id);
  if (fila === -1) return crearConvenio(datos);
  var h = hoja(HOJA_CONVENIOS);
  var encabezados = leerHoja(HOJA_CONVENIOS).encabezados;
  h.getRange(fila, 1, 1, encabezados.length).setValues([convenioAFila(datos, encabezados)]);
  guardarHistorial('convenio', datos.id, datos.historial);
  return datos;
}

function eliminarConvenio(id) {
  var fila = buscarFila(HOJA_CONVENIOS, id);
  if (fila !== -1) hoja(HOJA_CONVENIOS).deleteRow(fila);
  eliminarHistorial('convenio', id);
  return { id: id };
}

function crearSolicitud(datos) {
  var h = hoja(HOJA_SOLICITUDES);
  var encabezados = leerHoja(HOJA_SOLICITUDES).encabezados;
  datos.id = siguienteId(HOJA_SOLICITUDES);
  h.appendRow(solicitudAFila(datos, encabezados));
  guardarHistorial('solicitud', datos.id, datos.historial);
  return datos;
}

function actualizarSolicitud(datos) {
  var fila = buscarFila(HOJA_SOLICITUDES, datos.id);
  if (fila === -1) return crearSolicitud(datos);
  var h = hoja(HOJA_SOLICITUDES);
  var encabezados = leerHoja(HOJA_SOLICITUDES).encabezados;
  h.getRange(fila, 1, 1, encabezados.length).setValues([solicitudAFila(datos, encabezados)]);
  guardarHistorial('solicitud', datos.id, datos.historial);
  return datos;
}

function eliminarSolicitud(id) {
  var fila = buscarFila(HOJA_SOLICITUDES, id);
  if (fila !== -1) hoja(HOJA_SOLICITUDES).deleteRow(fila);
  eliminarHistorial('solicitud', id);
  return { id: id };
}


/* ── Identidad ─────────────────────────────────────────────────── */

/**
 * Verifica el ID token que envía la aplicación y devuelve
 * { ok: true, email } si la persona está autorizada.
 *
 * La verificación la hace Google: se le pregunta por el token y él responde
 * si la firma es válida y a quién pertenece. Por eso nadie puede fabricar
 * un token falso desde el navegador.
 */
function verificarIdentidad(idToken) {
  if (!USUARIOS_AUTORIZADOS || USUARIOS_AUTORIZADOS.length === 0) {
    return { ok: false, error: 'Falta configurar USUARIOS_AUTORIZADOS en el script.' };
  }
  if (CLIENT_ID.indexOf('PEGA-AQUI') === 0) {
    return { ok: false, error: 'Falta configurar CLIENT_ID en el script.' };
  }
  if (!idToken) {
    return { ok: false, error: 'Sesión no iniciada.' };
  }

  // Se guarda el resultado unos minutos: si no, cada clic en la app
  // significaría una consulta extra a Google.
  var cache = CacheService.getScriptCache();
  var clave = 'id:' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken));
  var enCache = cache.get(clave);
  if (enCache) return { ok: true, email: enCache };

  var datos;
  try {
    var respuesta = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
      { muteHttpExceptions: true });
    if (respuesta.getResponseCode() !== 200) {
      return { ok: false, error: 'Sesión expirada o inválida. Vuelve a entrar.' };
    }
    datos = JSON.parse(respuesta.getContentText());
  } catch (err) {
    return { ok: false, error: 'No se pudo verificar la sesión: ' + err };
  }

  // El token tiene que haber sido emitido PARA esta aplicación.
  if (datos.aud !== CLIENT_ID) {
    return { ok: false, error: 'La sesión no corresponde a esta aplicación.' };
  }
  if (String(datos.email_verified) !== 'true') {
    return { ok: false, error: 'La cuenta de Google no tiene el correo verificado.' };
  }

  var email = String(datos.email || '').toLowerCase();
  var autorizado = USUARIOS_AUTORIZADOS.some(function (u) {
    return String(u).toLowerCase().trim() === email;
  });
  if (!autorizado) {
    return { ok: false, error: 'La cuenta ' + email + ' no está autorizada para esta aplicación.' };
  }

  // El token de Google dura una hora; el cache, menos, para que dar de baja a
  // alguien surta efecto pronto.
  cache.put(clave, email, 300);
  return { ok: true, email: email };
}

/* ── Puntos de entrada HTTP ────────────────────────────────────────── */

/**
 * Envuelve la respuesta y le agrega la versión del script.
 *
 * La versión va en TODAS las respuestas, incluidos los rechazos, a propósito:
 * si sólo viajara cuando la identidad es válida, no serviría justamente cuando
 * más se necesita —diagnosticar por qué nadie puede entrar—. Es metadato del
 * despliegue, no información de nadie.
 */
function responder(obj) {
  var cuerpo = { version: VERSION_SCRIPT };
  for (var clave in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, clave)) cuerpo[clave] = obj[clave];
  }
  return ContentService.createTextOutput(JSON.stringify(cuerpo))
    .setMimeType(ContentService.MimeType.JSON);
}

function tokenValido(t) {
  return TOKEN === '' || String(t) === TOKEN;
}

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (!tokenValido(p.token)) return responder({ ok: false, error: 'Token inválido' });

    var identidad = verificarIdentidad(p.idToken);
    if (!identidad.ok) return responder({ ok: false, error: identidad.error, noAutorizado: true });

    if (p.accion === 'ping') {
      return responder({ ok: true, datos: { pong: true, email: identidad.email, version: VERSION_SCRIPT } });
    }
    return responder({ ok: true, datos: listarTodo() });
  } catch (err) {
    return responder({ ok: false, error: String(err) });
  }
}

/**
 * La app envía POST con Content-Type text/plain a propósito: así el navegador
 * lo trata como "simple request" y no dispara preflight OPTIONS, que Apps
 * Script no sabe responder. El cuerpo igual es JSON.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Sin lock, dos guardados simultáneos pueden pisarse al calcular el id.
    lock.waitLock(20000);
    var cuerpo = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!tokenValido(cuerpo.token)) return responder({ ok: false, error: 'Token inválido' });

    var identidad = verificarIdentidad(cuerpo.idToken);
    if (!identidad.ok) return responder({ ok: false, error: identidad.error, noAutorizado: true });

    var d = cuerpo.datos || {};
    var resultado;
    switch (cuerpo.accion + ':' + cuerpo.entidad) {
      case 'crear:convenio': resultado = crearConvenio(d); break;
      case 'actualizar:convenio': resultado = actualizarConvenio(d); break;
      case 'eliminar:convenio': resultado = eliminarConvenio(d.id); break;
      case 'crear:solicitud': resultado = crearSolicitud(d); break;
      case 'actualizar:solicitud': resultado = actualizarSolicitud(d); break;
      case 'eliminar:solicitud': resultado = eliminarSolicitud(d.id); break;
      default: return responder({ ok: false, error: 'Acción no reconocida: ' + cuerpo.accion + '/' + cuerpo.entidad });
    }
    return responder({ ok: true, datos: resultado });
  } catch (err) {
    return responder({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** Crea las tres hojas con sus encabezados. Ejecutar una vez desde el editor. */
function prepararPlanilla() {
  hoja(HOJA_CONVENIOS);
  hoja(HOJA_SOLICITUDES);
  hoja(HOJA_HISTORIAL);
}
