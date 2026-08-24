// De dónde salen y a dónde van los datos en cada momento.
//
// Hay tres situaciones distintas y antes se confundían dos de ellas:
//
//   'sheets'       la planilla está configurada y responde. Todo se guarda ahí,
//                  con copia local de respaldo.
//   'sin-conexion' la planilla está configurada pero no responde. Se puede
//                  seguir consultando lo que hay en el respaldo local, pero NO
//                  se puede escribir: los ids los asigna la planilla, así que
//                  un registro creado acá tendría un id inventado que chocaría
//                  con los suyos y desaparecería en la siguiente carga.
//   'local'        no hay planilla configurada. La app es de un solo navegador
//                  y localStorage es el almacén de verdad, no un respaldo.
//
// La distinción importa porque 'sin-conexion' es transitorio y se sale de él
// reintentando, mientras que 'local' es la forma normal de trabajar cuando
// nadie configuró VITE_SHEETS_API_URL.

export const MODO = {
  SHEETS: 'sheets',
  SIN_CONEXION: 'sin-conexion',
  LOCAL: 'local',
};

export function calcularModo(planillaConfigurada, planillaCaida) {
  if (!planillaConfigurada) return MODO.LOCAL;
  return planillaCaida ? MODO.SIN_CONEXION : MODO.SHEETS;
}

// ¿Los cambios tienen que viajar a la planilla?
export function usaPlanilla(modo) {
  return modo === MODO.SHEETS;
}

// ¿Se puede crear, editar o borrar? En 'sin-conexion' no: escribir sólo en
// local daría un "guardado ✓" que la siguiente carga se llevaría por delante.
export function permiteEscribir(modo) {
  return modo !== MODO.SIN_CONEXION;
}

export function etiquetaModo(modo) {
  if (modo === MODO.SHEETS) return 'Google Sheets (con respaldo local)';
  if (modo === MODO.SIN_CONEXION) return 'Sin conexión con la planilla (sólo lectura)';
  return 'localStorage (sólo este navegador)';
}

// Mensaje para cuando se intenta escribir sin conexión. `accion` es un verbo en
// infinitivo: 'crear el convenio', 'guardar la solicitud', …
export function mensajeSinConexion(accion) {
  return `No se puede ${accion}: la planilla no responde. `
    + 'Los cambios se perderían al recuperar la conexión. Reintenta y vuelve a intentarlo.';
}
