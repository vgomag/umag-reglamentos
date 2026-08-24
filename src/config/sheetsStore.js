// Persistencia de convenios y solicitudes en Google Sheets.
//
// La app es un sitio estático: no tiene servidor propio. En vez de hablar
// directamente con la API de Google (que exigiría OAuth o una cuenta de
// servicio), habla con un Apps Script publicado como aplicación web desde la
// propia planilla. El script está en google-apps-script/Codigo.gs.
//
// Si no hay URL configurada, la app funciona igual guardando en localStorage.

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

// Lee la respuesta del script, que siempre tiene forma { ok, datos | error }.
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
  if (!cuerpo.ok) throw new Error(cuerpo.error || 'Error desconocido del script');
  return cuerpo.datos;
}

/**
 * POST al Apps Script.
 *
 * Va con Content-Type text/plain A PROPÓSITO: así el navegador lo trata como
 * "simple request" y no dispara la petición preflight OPTIONS, que Apps Script
 * no sabe responder. El cuerpo sigue siendo JSON y el script lo parsea igual.
 */
async function enviar(accion, entidad, datos) {
  if (!sheetsConfigurado()) return { ok: false, error: 'Google Sheets no configurado' };
  try {
    const respuesta = await fetchConTimeout(SHEETS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: SHEETS_TOKEN, accion, entidad, datos }),
      redirect: 'follow',
    });
    return { ok: true, datos: await leerRespuesta(respuesta, `${accion}:${entidad}`) };
  } catch (e) {
    const mensaje = e.name === 'AbortError' ? 'La planilla no respondió a tiempo' : e.message;
    registrarError(`${accion}:${entidad}`, mensaje);
    return { ok: false, error: mensaje };
  }
}

export async function fetchTodo() {
  if (!sheetsConfigurado()) return { data: null, error: null };
  try {
    const url = `${SHEETS_API_URL}?token=${encodeURIComponent(SHEETS_TOKEN)}`;
    const respuesta = await fetchConTimeout(url, { method: 'GET', redirect: 'follow' });
    const datos = await leerRespuesta(respuesta, 'listar');
    return {
      data: {
        convenios: Array.isArray(datos?.convenios) ? datos.convenios : [],
        solicitudes: Array.isArray(datos?.solicitudes) ? datos.solicitudes : [],
      },
      error: null,
    };
  } catch (e) {
    const mensaje = e.name === 'AbortError' ? 'La planilla no respondió a tiempo' : e.message;
    registrarError('listar', mensaje);
    return { data: null, error: mensaje };
  }
}

// Comprueba la conexión sin traer datos; lo usa la vista de Configuración.
export async function probarConexion() {
  if (!sheetsConfigurado()) return { ok: false, error: 'Falta VITE_SHEETS_API_URL' };
  try {
    const url = `${SHEETS_API_URL}?accion=ping&token=${encodeURIComponent(SHEETS_TOKEN)}`;
    const respuesta = await fetchConTimeout(url, { method: 'GET', redirect: 'follow' });
    await leerRespuesta(respuesta, 'ping');
    return { ok: true, error: null };
  } catch (e) {
    const mensaje = e.name === 'AbortError' ? 'La planilla no respondió a tiempo' : e.message;
    registrarError('ping', mensaje);
    return { ok: false, error: mensaje };
  }
}

export const crearConvenioRemoto = (convenio) => enviar('crear', 'convenio', convenio);
export const actualizarConvenioRemoto = (convenio) => enviar('actualizar', 'convenio', convenio);
export const eliminarConvenioRemoto = (id) => enviar('eliminar', 'convenio', { id });

export const crearSolicitudRemota = (solicitud) => enviar('crear', 'solicitud', solicitud);
export const actualizarSolicitudRemota = (solicitud) => enviar('actualizar', 'solicitud', solicitud);
export const eliminarSolicitudRemota = (id) => enviar('eliminar', 'solicitud', { id });
