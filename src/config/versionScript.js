// Qué versión del Apps Script espera esta app.
//
// POR QUÉ EXISTE ESTO
// El backend vive en Google, fuera del repositorio y fuera del despliegue de
// Netlify. Guardar el código en el editor de Apps Script no actualiza la
// aplicación web —hay que publicar una versión nueva— y es fácil hacer sólo lo
// primero: el editor muestra el código nuevo mientras la planilla sigue
// respondiendo con el viejo, sin ninguna señal de que algo quedó a medias.
//
// El script devuelve su VERSION_SCRIPT en cada respuesta y acá se compara con
// lo que el repositorio espera. Configuración lo muestra al comprobar la
// conexión.
//
// ⚠ Este número tiene que coincidir con VERSION_SCRIPT en
// google-apps-script/Codigo.gs. No se sincroniza solo, pero versionScript.test.js
// falla si alguien sube uno y se olvida del otro.

export const VERSION_SCRIPT_ESPERADA = '2';

export const ESTADO_VERSION = {
  COINCIDE: 'coincide',
  ANTIGUA: 'antigua',        // lo publicado es anterior al repositorio
  ADELANTADA: 'adelantada',  // lo publicado es posterior: el repo va atrasado
  SIN_VERSION: 'sin-version', // el script publicado no informa versión
};

/**
 * Compara la versión que informó la planilla con la que espera esta app.
 *
 * @returns { estado, publicada, esperada, alDia, mensaje }
 */
export function compararVersionScript(publicada, esperada = VERSION_SCRIPT_ESPERADA) {
  const suya = (publicada ?? '').toString().trim();
  const nuestra = (esperada ?? '').toString().trim();

  if (!suya) {
    return {
      estado: ESTADO_VERSION.SIN_VERSION,
      publicada: '',
      esperada: nuestra,
      alDia: false,
      mensaje: 'La planilla no informa su versión, así que está publicando código anterior '
        + `a esta comprobación. Publica una versión nueva del Apps Script (se espera la ${nuestra}).`,
    };
  }

  if (suya === nuestra) {
    return {
      estado: ESTADO_VERSION.COINCIDE,
      publicada: suya,
      esperada: nuestra,
      alDia: true,
      mensaje: `El Apps Script publicado es la versión ${suya}, la misma que espera esta app.`,
    };
  }

  // Las versiones son enteros crecientes; si alguna no lo es, se comparan como
  // texto y se informa la diferencia sin afirmar cuál es más nueva.
  const a = Number(suya);
  const b = Number(nuestra);
  const comparables = Number.isFinite(a) && Number.isFinite(b);
  const adelantada = comparables && a > b;

  if (adelantada) {
    return {
      estado: ESTADO_VERSION.ADELANTADA,
      publicada: suya,
      esperada: nuestra,
      alDia: false,
      mensaje: `La planilla publica la versión ${suya} y esta app espera la ${nuestra}: `
        + 'el sitio quedó atrás. Vuelve a desplegar el frontend.',
    };
  }

  return {
    estado: ESTADO_VERSION.ANTIGUA,
    publicada: suya,
    esperada: nuestra,
    alDia: false,
    mensaje: `La planilla sigue publicando la versión ${suya} y esta app espera la ${nuestra}. `
      + 'Guardar el código en el editor no basta: Implementar → Gestionar implementaciones → ✏️ → '
      + 'Versión: Nueva versión.',
  };
}
