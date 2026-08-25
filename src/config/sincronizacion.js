// Operaciones por lote contra la planilla.
//
// Importar un respaldo o vaciar el registro son operaciones sobre muchas filas,
// y en una planilla remota cualquiera de ellas puede fallar sola. Estas
// funciones hacen el trabajo registro por registro y devuelven por separado lo
// que sí ocurrió y lo que no, para que la app actualice en pantalla sólo lo
// que realmente cambió en la planilla y pueda decir con precisión qué faltó.
//
// El recorrido es SECUENCIAL a propósito, igual que en la carga de ejemplos: la
// planilla asigna los ids de a uno y cada borrado desplaza las filas siguientes,
// así que en paralelo se pisarían.

/**
 * Crea una lista de registros en la planilla.
 *
 * @param registros    los que se quieren crear (sin id: lo pone la planilla)
 * @param crearRemoto  crearConvenioRemoto o crearSolicitudRemota
 * @param normalizar   normalizarConvenio o normalizarSolicitud
 * @returns { creados, fallidos } — `creados` ya viene normalizado y con el id
 *          que asignó la planilla; `fallidos` lleva el registro y su error.
 */
export async function crearLoteRemoto(registros, crearRemoto, normalizar) {
  const creados = [];
  const fallidos = [];
  for (const registro of registros) {
    // eslint-disable-next-line no-await-in-loop
    const { ok, datos, error, noAutorizado } = await crearRemoto(registro);
    if (ok) creados.push(normalizar({ ...registro, ...datos }));
    else fallidos.push({ registro, error, noAutorizado: Boolean(noAutorizado) });
  }
  return { creados, fallidos };
}

/**
 * Elimina una lista de registros de la planilla.
 *
 * @returns { eliminados, fallidos } — sólo los de `eliminados` deben sacarse
 *          de la pantalla; los que fallaron siguen existiendo en la planilla.
 */
export async function eliminarLoteRemoto(registros, eliminarRemoto) {
  const eliminados = [];
  const fallidos = [];
  for (const registro of registros) {
    // eslint-disable-next-line no-await-in-loop
    const { ok, error, noAutorizado } = await eliminarRemoto(registro.id);
    if (ok) eliminados.push(registro);
    else fallidos.push({ registro, error, noAutorizado: Boolean(noAutorizado) });
  }
  return { eliminados, fallidos };
}

// ¿Alguno de los fallos fue por identidad? Eso no se arregla reintentando:
// hay que volver a entrar.
export function huboRechazoDeAcceso(fallidos = []) {
  return fallidos.some(f => f.noAutorizado);
}

/**
 * Los sustantivos que la app cuenta en lotes, con su plural y su género.
 *
 * Van escritos, no deducidos: el plural de "solicitud" es "solicitudes" y el de
 * "registro de ejemplo" es "registros de ejemplo", así que ninguna regla
 * automática acierta las tres. Y sin el género salen cosas como "1 solicitud
 * eliminado".
 */
export const ENTIDADES = {
  convenio: { una: 'convenio', varias: 'convenios', femenino: false },
  solicitud: { una: 'solicitud', varias: 'solicitudes', femenino: true },
  ejemplo: { una: 'registro de ejemplo', varias: 'registros de ejemplo', femenino: false },
};

// Participio de un verbo regular: importar → importado, añadir → añadido.
// Se forma acá en vez de recibirlo ya conjugado, que era de donde salían los
// "1 convenio importados".
function participio(infinitivo) {
  const raiz = infinitivo.slice(0, -2);
  return infinitivo.endsWith('ar') ? `${raiz}ado` : `${raiz}ido`;
}

/**
 * Aviso para el usuario después de un lote. Distingue los tres desenlaces
 * porque son tres cosas distintas: todo salió, salió una parte, o no salió nada.
 *
 * @param accion   infinitivo del verbo: 'importar', 'eliminar'
 * @param entidad  una entrada de ENTIDADES
 */
export function avisoLote(hechos, fallidos, accion, entidad = ENTIDADES.convenio) {
  const { una, varias, femenino } = entidad;
  const nombre = (n) => (n === 1 ? una : varias);
  const hecho = (n) => {
    const base = participio(accion);
    const concordado = femenino ? `${base.slice(0, -1)}a` : base;
    return n === 1 ? concordado : `${concordado}s`;
  };
  const articulo = femenino ? 'la' : 'el';
  const ninguno = femenino ? 'ninguna de las' : 'ninguno de los';
  const detalle = fallidos[0]?.error ? ` Primer error: ${fallidos[0].error}.` : '';

  if (fallidos.length === 0) {
    if (hechos.length === 0) return { type: 'success', message: `No había nada que ${accion}.` };
    return { type: 'success', message: `${hechos.length} ${nombre(hechos.length)} ${hecho(hechos.length)}.` };
  }

  if (hechos.length === 0) {
    const cuantos = fallidos.length === 1
      ? `${articulo} ${una}`
      : `${ninguno} ${fallidos.length} ${nombre(fallidos.length)}`;
    return { type: 'error', message: `No se pudo ${accion} ${cuantos}.${detalle}` };
  }

  const total = hechos.length + fallidos.length;
  const quedaron = fallidos.length === 1
    ? '1 quedó sin cambios en la planilla'
    : `${fallidos.length} quedaron sin cambios en la planilla`;
  return {
    type: 'error',
    message: `${hechos.length} de ${total} ${nombre(total)} ${hecho(hechos.length)}. ${quedaron}.${detalle}`,
  };
}
