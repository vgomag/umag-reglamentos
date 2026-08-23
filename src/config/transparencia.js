// Dominio de Transparencia Pasiva — Ley N°20.285 sobre Acceso a la Información Pública.
//
// Los plazos y etapas siguen la ley y el acuse de recibo del Portal de
// Transparencia (formato de solicitud UN016T…, Universidad de Magallanes).

// Plazos legales, todos en DÍAS HÁBILES administrativos (Ley 19.880 art. 25:
// se excluyen sábados, domingos y festivos).
export const PLAZOS_LEY_20285 = {
  RESPUESTA: { dias: 20, articulo: 'Art. 14', descripcion: 'Plazo máximo para pronunciarse sobre la solicitud.' },
  PRORROGA: { dias: 10, articulo: 'Art. 14 inc. 2°', descripcion: 'Prórroga excepcional, comunicada antes del vencimiento.' },
  SUBSANACION: { dias: 5, articulo: 'Art. 12 inc. 2°', descripcion: 'Plazo del solicitante para subsanar; si no lo hace, se le tiene por desistido.' },
  NOTIFICACION_TERCERO: { dias: 2, articulo: 'Art. 20', descripcion: 'Plazo para comunicar a terceros que pueden oponerse.' },
  OPOSICION_TERCERO: { dias: 3, articulo: 'Art. 20 inc. 2°', descripcion: 'Plazo del tercero para oponerse a la entrega.' },
  AMPARO: { dias: 15, articulo: 'Art. 24', descripcion: 'Plazo del solicitante para recurrir de amparo ante el CPLT.' },
};

// Etapas del Portal de Transparencia (escritorio del funcionario).
export const ETAPAS_SOLICITUD = [
  'Ingreso y recepción',
  'Análisis y búsqueda',
  'Cumplimiento de lo resuelto',
  'Cerrada',
];

export const ESTADOS_SOLICITUD = [
  'Ingresada',
  'En análisis de admisibilidad',
  'En subsanación',
  'Derivada',
  'En búsqueda de información',
  'En oposición de tercero',
  'Prorrogada',
  'Respondida',
  'Denegada',
  'Desistida',
  'Anulada',
];

export const ESTADOS_SOLICITUD_CERRADOS = ['Respondida', 'Denegada', 'Desistida', 'Anulada'];

export const TIPOS_PERSONA = ['Natural', 'Jurídica'];

export const VIAS_INGRESO = ['Portal de Transparencia', 'Oficina de Partes', 'Correo electrónico', 'Derivación de otro organismo'];

export const FORMATOS_ENTREGA = ['Electrónico/PDF', 'Electrónico/Word', 'Electrónico/Excel', 'Papel', 'Sin especificar'];

export const MEDIOS_ENVIO = ['Correo electrónico', 'Retiro en oficina', 'Carta certificada'];

// Causales de secreto o reserva (Art. 21), para fundar una denegación.
export const CAUSALES_RESERVA = [
  { id: '21-1', label: 'Art. 21 N°1 — Afecta el debido cumplimiento de las funciones del órgano' },
  { id: '21-2', label: 'Art. 21 N°2 — Afecta derechos de las personas (esfera privada, comercial, seguridad)' },
  { id: '21-3', label: 'Art. 21 N°3 — Afecta la seguridad de la Nación' },
  { id: '21-4', label: 'Art. 21 N°4 — Afecta el interés nacional' },
  { id: '21-5', label: 'Art. 21 N°5 — Documentos declarados reservados por ley de quórum calificado' },
];

export function crearSolicitud(datos = {}) {
  return {
    id: datos.id,
    codigo: datos.codigo || '',
    fechaIngreso: datos.fechaIngreso || '',
    solicitante: datos.solicitante || '',
    tipoPersona: datos.tipoPersona || 'Natural',
    email: datos.email || '',
    telefono: datos.telefono || '',
    viaIngreso: datos.viaIngreso || 'Portal de Transparencia',
    materia: datos.materia || '',
    unidadDerivada: datos.unidadDerivada || '',
    etapa: datos.etapa || 'Ingreso y recepción',
    estado: datos.estado || 'Ingresada',
    prorrogada: Boolean(datos.prorrogada),
    fechaProrroga: datos.fechaProrroga || '',
    subsanacionSolicitada: Boolean(datos.subsanacionSolicitada),
    fechaSubsanacion: datos.fechaSubsanacion || '',
    terceroInvolucrado: Boolean(datos.terceroInvolucrado),
    fechaRespuesta: datos.fechaRespuesta || '',
    causalReserva: datos.causalReserva || '',
    formatoEntrega: datos.formatoEntrega || 'Electrónico/PDF',
    medioEnvio: datos.medioEnvio || 'Correo electrónico',
    observaciones: datos.observaciones || '',
    historial: datos.historial || [],
  };
}

export function normalizarSolicitud(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const base = crearSolicitud(raw);
  return { ...base, historial: Array.isArray(raw.historial) ? raw.historial : [] };
}
