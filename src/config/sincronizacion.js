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
 * Aviso para el usuario después de un lote. Distingue los tres desenlaces
 * porque son tres cosas distintas: todo salió, salió una parte, o no salió nada.
 *
 * @param accion  participio plural: 'importados', 'eliminados'
 */
export function avisoLote(hechos, fallidos, accion, entidad = 'registro') {
  const plural = (n) => (n === 1 ? entidad : `${entidad}s`);
  if (fallidos.length === 0) {
    return { type: 'success', message: `${hechos.length} ${plural(hechos.length)} ${accion}.` };
  }
  const detalle = fallidos[0]?.error ? ` Primer error: ${fallidos[0].error}.` : '';
  if (hechos.length === 0) {
    return {
      type: 'error',
      message: `No se pudo ${accion === 'importados' ? 'importar' : 'eliminar'} `
        + `ninguno de los ${fallidos.length} ${plural(fallidos.length)}.${detalle}`,
    };
  }
  return {
    type: 'error',
    message: `${hechos.length} de ${hechos.length + fallidos.length} ${plural(2)} ${accion}. `
      + `${fallidos.length} quedaron sin cambios en la planilla.${detalle}`,
  };
}
