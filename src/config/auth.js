// Inicio de sesión con Google (Google Identity Services).
//
// CÓMO FUNCIONA LA RESTRICCIÓN
// El navegador obtiene un ID token firmado por Google y lo manda en cada
// petición al Apps Script. El script verifica esa firma contra Google y
// comprueba que el correo esté en su lista de autorizados.
//
// La lista vive en el Apps Script, NO aquí. Eso es lo que hace que la
// restricción sea real: alguien que edite el JavaScript del navegador puede
// saltarse la pantalla de acceso, pero no va a conseguir que la planilla le
// responda, porque quien decide es el script.
//
// No hay roles: quien está en la lista tiene acceso completo.

export const GOOGLE_CLIENT_ID = import.meta.env?.VITE_GOOGLE_CLIENT_ID || '';

const CLAVE_SESION = 'umag_google_token';
const GSI_SRC = 'https://accounts.google.com/gsi/client';

export function googleConfigurado() {
  return Boolean(GOOGLE_CLIENT_ID);
}

/** Carga la librería de Google una sola vez. */
let promesaGsi = null;
export function cargarGoogleIdentity() {
  if (promesaGsi) return promesaGsi;
  promesaGsi = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) { resolve(window.google.accounts.id); return; }
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts?.id) resolve(window.google.accounts.id);
      else reject(new Error('La librería de Google cargó pero no quedó disponible.'));
    };
    script.onerror = () => reject(new Error('No se pudo cargar el inicio de sesión de Google. Revisa tu conexión.'));
    document.head.appendChild(script);
  });
  return promesaGsi;
}

/**
 * Lee la carga útil de un ID token.
 *
 * ⚠ Sólo para MOSTRAR el nombre y el correo en pantalla. No sirve para decidir
 * si alguien tiene acceso: cualquiera puede fabricar un JWT con el contenido
 * que quiera. Quien valida la firma es el Apps Script.
 */
export function leerToken(idToken) {
  if (!idToken || typeof idToken !== 'string') return null;
  const partes = idToken.split('.');
  if (partes.length !== 3) return null;
  try {
    const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const relleno = base64 + '==='.slice((base64.length + 3) % 4);
    const binario = atob(relleno);
    // Los nombres con tildes vienen en UTF-8: hay que decodificarlos como tal.
    const bytes = Uint8Array.from(binario, c => c.charCodeAt(0));
    const datos = JSON.parse(new TextDecoder('utf-8').decode(bytes));
    return {
      email: datos.email || '',
      nombre: datos.name || datos.email || '',
      foto: datos.picture || '',
      expira: Number(datos.exp) || 0,
    };
  } catch {
    return null;
  }
}

export function tokenVigente(idToken, ahora = Math.floor(Date.now() / 1000)) {
  const datos = leerToken(idToken);
  if (!datos || !datos.expira) return false;
  // Margen de 60 s para no usar un token que caduca a mitad de la petición.
  return datos.expira - 60 > ahora;
}

/* ------------------------- sesión en el navegador ------------------------ */

export function guardarSesion(idToken) {
  try { sessionStorage.setItem(CLAVE_SESION, idToken); } catch { /* modo privado */ }
}

export function leerSesion() {
  try {
    const token = sessionStorage.getItem(CLAVE_SESION);
    return token && tokenVigente(token) ? token : null;
  } catch {
    return null;
  }
}

export function cerrarSesion() {
  try { sessionStorage.removeItem(CLAVE_SESION); } catch { /* ignorar */ }
  try { window.google?.accounts?.id?.disableAutoSelect(); } catch { /* ignorar */ }
}

export function usuarioDeSesion(idToken = leerSesion()) {
  return idToken ? leerToken(idToken) : null;
}

/**
 * Dibuja el botón oficial de Google dentro de `contenedor`.
 * `onCredencial` recibe el ID token cuando la persona termina de entrar.
 */
export async function montarBotonGoogle(contenedor, onCredencial) {
  if (!googleConfigurado()) throw new Error('Falta configurar VITE_GOOGLE_CLIENT_ID.');
  const id = await cargarGoogleIdentity();
  id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (respuesta) => {
      if (respuesta?.credential) onCredencial(respuesta.credential);
    },
    // Sin selección automática: que cada quien elija su cuenta explícitamente.
    auto_select: false,
    cancel_on_tap_outside: true,
  });
  // Google AÑADE su botón al contenedor, no lo reemplaza: si esta función se
  // llamara dos veces sobre el mismo nodo quedarían dos botones. Vaciarlo
  // primero hace que montar de nuevo sea inofensivo.
  contenedor.innerHTML = '';
  id.renderButton(contenedor, {
    type: 'standard',
    theme: 'filled_blue',
    size: 'large',
    text: 'signin_with',
    shape: 'pill',
    locale: 'es',
    width: 280,
  });
  return id;
}
