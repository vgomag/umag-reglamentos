// Persistencia de convenios y solicitudes en Google Sheets.
//
// La app es un sitio estático: no tiene servidor propio. En vez de hablar
// directamente con la API de Google (que exigiría OAuth o una cuenta de
// servicio), habla con un Apps Script publicado como aplicación web desde la
// propia planilla. El script está en google-apps-script/Codigo.gs.
//
// Si no hay URL configurada, la app funciona igual guardando en localStorage.

import { leerSesion } from './auth';

export const SHEETS_API_URL = import.meta.env?.VITE_SHEETS_API_URL || '';
export const SHEETS_TOKEN = import.meta.env?.VITE_SHEETS_TOKEN || '';

// Enlaces informativos que se muestran en Configuración.
export const SHEET_URL = import.meta.env?.VITE_SHEET_URL || '';
export const DRIVE_FOLDER_URL = import.meta.env?.VITE_DRIVE_FOLDER_URL || '';

const TIMEOUT_MS = 20000;

export function sheetsConfigurado() {
  return Boolean(SHEETS_API_URL);
}

let ultimoError = null;
export function getUltimoErrorSheets() { return ultimoError; }

function registrarError(op, mensaje) {
  ultimoError = { op, error: mensaje, at: new Date().toISOString() };
  console.error(`[sheets:${op}]`, mensaje);
}

// fetch con límite de tiempo: si el Apps Script se cuelga, la UI no se queda
// esperando para siempre.
async function fetchConTimeout(url, opciones = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opciones, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Lee la respuesta del script, que siempre tiene forma
// { version, ok, datos | error }.
//
// La versión viaja también en los rechazos, así que se conserva en el error:
// saber qué versión está publicada es justamente lo que hace falta cuando algo
// no funciona.
async function leerRespuesta(respuesta, op) {
  if (!respuesta.ok) {
    throw new Error(`HTTP ${respuesta.status} ${respuesta.statusText || ''}`.trim());
  }
  const texto = await respuesta.text();
  let cuerpo;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    // Apps Script devuelve HTML cuando la implementación no es pública o la
    // sesión de Google pide iniciar sesión: es el error más habitual al montarlo.
    throw new Error('La respuesta no es JSON. Revisa que la implementación esté publicada con acceso "Cualquier usuario".');
  }
  const version = (cuerpo.version ?? '').toString();
  if (!cuerpo.ok) {
    const error = new Error(cuerpo.error || 'Error desconocido del script');
    // El script marca así los rechazos por identidad, para que la app pueda
    // pedir que se vuelva a entrar en vez de mostrar un error cualquiera.
    if (cuerpo.noAutorizado) error.noAutorizado = true;
    error.version = version;
    throw error;
  }
  return { datos: cuerpo.datos, version };
}

/**
 * POST al Apps Script. Lo usan TODAS las operaciones, incluidas las lecturas.
 *
 * Va con Content-Type text/plain A PROPÓSITO: así el navegador lo trata como
 * "simple request" y no dispara la petición preflight OPTIONS, que Apps Script
 * no sabe responder. El cuerpo sigue siendo JSON y el script lo parsea igual.
 *
 * Que las lecturas también vayan por acá es lo que mantiene el ID token de
 * Google fuera de la URL: como parámetro quedaba escrito en los registros de
 * ejecución de Apps Script, en el historial del navegador y en cualquier proxy
 * intermedio. En el cuerpo de un POST no queda en ninguno de los tres.
 */
async function enviar(accion, entidad, datos) {
  const op = entidad ? `${accion}:${entidad}` : accion;
  if (!sheetsConfigurado()) return { ok: false, error: 'Google Sheets no configurado' };
  try {
    const respuesta = await fetchConTimeout(SHEETS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: SHEETS_TOKEN, idToken: leerSesion(), accion, entidad, datos }),
      redirect: 'follow',
    });
    // Ojo: el parámetro de esta función también se llama `datos`.
    const respondido = await leerRespuesta(respuesta, op);
    return { ok: true, datos: respondido.datos, version: respondido.version };
  } catch (e) {
    const mensaje = e.name === 'AbortError' ? 'La planilla no respondió a tiempo' : e.message;
    registrarError(op, mensaje);
    return { ok: false, error: mensaje, noAutorizado: Boolean(e.noAutorizado), version: e.version || '' };
  }
}

export async function fetchTodo() {
  if (!sheetsConfigurado()) return { data: null, error: null };
  const { ok, datos, error, noAutorizado, version } = await enviar('listar');
  if (!ok) return { data: null, error, noAutorizado, version };
  return {
    data: {
      convenios: Array.isArray(datos?.convenios) ? datos.convenios : [],
      solicitudes: Array.isArray(datos?.solicitudes) ? datos.solicitudes : [],
    },
    error: null,
    version,
  };
}

// Comprueba la conexión sin traer datos; lo usa la vista de Configuración.
export async function probarConexion() {
  if (!sheetsConfigurado()) return { ok: false, error: 'Falta VITE_SHEETS_API_URL', version: '' };
  const { ok, datos, error, noAutorizado, version } = await enviar('ping');
  return {
    ok,
    error: ok ? null : error,
    noAutorizado: Boolean(noAutorizado),
    // La versión viene en el sobre; el ping la repite dentro por comodidad.
    version: datos?.version || version || '',
  };
}

export const crearConvenioRemoto = (convenio) => enviar('crear', 'convenio', convenio);
export const actualizarConvenioRemoto = (convenio) => enviar('actualizar', 'convenio', convenio);
export const eliminarConvenioRemoto = (id) => enviar('eliminar', 'convenio', { id });

export const crearSolicitudRemota = (solicitud) => enviar('crear', 'solicitud', solicitud);
export const actualizarSolicitudRemota = (solicitud) => enviar('actualizar', 'solicitud', solicitud);
export const eliminarSolicitudRemota = (id) => enviar('eliminar', 'solicitud', { id });
