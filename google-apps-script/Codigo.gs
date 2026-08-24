/**
 * Backend de "UMAG · Transparencia" sobre Google Sheets.
 *
 * Este script vive DENTRO de la planilla y se publica como aplicación web.
 * La app (sitio estático en Netlify) le habla por HTTP; no hay servidor propio,
 * ni proyecto en Google Cloud, ni cuenta de servicio.
 *
 * ── Instalación ──────────────────────────────────────────────────────────
 * 1. Abre la planilla → Extensiones → Apps Script.
 * 2. Reemplaza el contenido de Código.gs por este archivo y guarda.
 * 3. Edita TOKEN abajo y pon una cadena larga y aleatoria propia.
 * 4. Implementar → Nueva implementación → Aplicación web:
 *      - Ejecutar como: Yo
 *      - Quién tiene acceso: Cualquier usuario
 *    Copia la URL que termina en /exec.
 * 5. En Netlify define las variables de entorno:
 *      VITE_SHEETS_API_URL = la URL /exec
 *      VITE_SHEETS_TOKEN   = el mismo TOKEN de abajo
 *
 * ⚠ "Cualquier usuario" significa que quien conozca la URL puede llamarla, por
 * eso existe el TOKEN. Ambos viajan en el bundle del navegador, así que ofrecen
 * el mismo nivel de protección que la contraseña actual de la app: disuaden,
 * no son autenticación fuerte. Para datos sensibles, usa una cuenta de servicio
 * detrás de una función de Netlify.
 *
 * ── Cómo guarda los datos ────────────────────────────────────────────────
 * Las etapas de cada convenio se guardan en columnas planas (VRAC_inicio,
 * VRAC_estado, …) en vez de como JSON, para que la planilla siga siendo
 * legible y editable a mano. El historial va en su propia hoja, una fila por
 * evento, que es la forma natural de un registro cronológico.
 */

var TOKEN = 'CAMBIA-ESTE-TOKEN-POR-UNO-LARGO-Y-ALEATORIO';

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

/* ── Encabezados ───────────────────────────────────────────────────────── */

function encabezadosConvenios() {
  var cols = CAMPOS_CONVENIO.map(function (c) { return c[0]; });
  UNIDADES.forEach(function (u) {
    cols.push(u + '_inicio', u + '_termino', u + '_estado', u + '_observaciones');
  });
  cols.push('actualizado');
  return cols;
}

function encabezadosSolicitudes() {
  return CAMPOS_SOLICITUD.map(function (c) { return c[0]; }).concat(['actualizado']);
}

// Devuelve la hoja pedida, creándola con sus encabezados si no existe.
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
  }
  return h;
}

/* ── Conversión fila ↔ objeto ──────────────────────────────────────────── */

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
  UNIDADES.forEach(function (u, orden) {
    var estado = aTexto(fila[idx[u + '_estado']]);
    var inicio = aTexto(fila[idx[u + '_inicio']]);
    var termino = aTexto(fila[idx[u + '_termino']]);
    var obs = aTexto(fila[idx[u + '_observaciones']]);
    // Una unidad sin ningún dato no participa en este convenio.
    if (!estado && !inicio && !termino && !obs) return;
    obj.etapas.push({
      unidad: u, orden: orden,
      fechaInicio: inicio, fechaTermino: termino,
      estado: estado || 'Pendiente', observaciones: obs,
    });
  });

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

/* ── Lectura ───────────────────────────────────────────────────────────── */

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

/* ── Escritura ─────────────────────────────────────────────────────────── */

function buscarFila(nombreHoja, id) {
  var datos = leerHoja(nombreHoja);
  for (var i = 0; i < datos.filas.length; i++) {
    if (Number(datos.filas[i][0]) === Number(id)) return i + 2; // +2: encabezado y base 1
  }
  return -1;
}

function siguienteId(nombreHoja) {
  var datos = leerHoja(nombreHoja);
  var max = 0;
  datos.filas.forEach(function (f) { max = Math.max(max, Number(f[0]) || 0); });
  return max + 1;
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
  return { id: id };
}

/* ── Puntos de entrada HTTP ────────────────────────────────────────────── */

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function tokenValido(t) {
  return TOKEN === '' || String(t) === TOKEN;
}

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (!tokenValido(p.token)) return responder({ ok: false, error: 'Token inválido' });
    if (p.accion === 'ping') return responder({ ok: true, datos: { pong: true } });
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
