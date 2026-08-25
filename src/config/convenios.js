// Dominio de Convenios Institucionales.
//
// Base normativa: Res. N°216/2019 sobre tramitación de convenios y contratos,
// y Estatuto UMAG Art. 82-86. El flujo de visación es secuencial pero NO
// rígido: según el convenio, algunas unidades no participan y el orden puede
// variar.

// Unidades/autoridades que pueden participar en la tramitación.
export const UNIDADES = [
  { id: 'VRAF', nombre: 'VRAF', descripcion: 'Vicerrectoría de Administración y Finanzas', color: '#0ea5e9' },
  { id: 'VRAC', nombre: 'VRAC', descripcion: 'Vicerrectoría Académica', color: '#8b5cf6' },
  { id: 'VRIIP', nombre: 'VRIIP', descripcion: 'Vicerrectoría de Investigación, Innovación y Postgrado', color: '#ec4899' },
  { id: 'VVM', nombre: 'VVM', descripcion: 'Vicerrectoría de Vinculación con el Medio', color: '#f59e0b' },
  { id: 'PRO', nombre: 'PRO', descripcion: 'Prorrectoría', color: '#14b8a6' },
  { id: 'CONTRALORIA', nombre: 'Contraloría', descripcion: 'Contraloría Universitaria', color: '#ef4444' },
  { id: 'RECTORIA', nombre: 'Rectoría', descripcion: 'Rectoría', color: '#1d4ed8' },
];

export const UNIDAD_IDS = UNIDADES.map(u => u.id);

export function getUnidad(id) {
  return UNIDADES.find(u => u.id === id) || null;
}

export function nombreUnidad(id) {
  const u = getUnidad(id);
  return u ? u.nombre : (id || '—');
}

// Flujo sugerido por defecto, según el orden de visación de la Res. N°216/2019:
// primero la vicerrectoría temática que corresponda al objeto del convenio
// (académica, investigación o vinculación) y después VRAF, que visa cuando el
// convenio compromete recursos; luego Prorrectoría, Contraloría y Rectoría.
//
// Se puede adaptar convenio por convenio: quitar unidades que no participan,
// agregar otras o reordenarlas (reglas de negocio N°5 y N°6).
export const FLUJO_POR_DEFECTO = ['VRAC', 'VRIIP', 'VVM', 'VRAF', 'PRO', 'CONTRALORIA', 'RECTORIA'];

// Estado global del convenio.
export const ESTADOS_CONVENIO = [
  'Ingresado',
  'En Tramitación',
  'Pendiente Rectoría',
  'Finalizado',
  'Observado',
  'Anulado',
];

// Estados terminales: no siguen consumiendo plazo ni aparecen como pendientes.
export const ESTADOS_CERRADOS = ['Finalizado', 'Anulado'];

// Estado de cada etapa de seguimiento.
export const ESTADOS_ETAPA = [
  'Pendiente',    // aún no llega a la unidad
  'En Revisión',  // la unidad la tiene en sus manos
  'Aprobado',     // visada, sigue el flujo
  'Observado',    // devuelta con observaciones
  'No Aplica',    // la unidad no participa en este convenio
];

// Etapas que cuentan como "el convenio está aquí ahora".
export const ESTADOS_ETAPA_ACTIVA = ['En Revisión', 'Observado'];

export const PRIORIDADES = ['normal', 'alta', 'urgente'];

// Tipos de convenio más frecuentes (editable desde Configuración).
export const TIPOS_CONVENIO = [
  'Colaboración académica',
  'Práctica profesional',
  'Investigación',
  'Vinculación con el medio',
  'Prestación de servicios',
  'Convenio marco',
  'Convenio específico',
  'Otro',
];

// Umbral en días corridos para marcar un convenio como "próximo a vencer" 🟡.
export const DIAS_ALERTA_VENCIMIENTO = 7;

// Ventana en días corridos para el indicador "ingresados recientemente".
export const DIAS_INGRESO_RECIENTE = 30;

// Semáforo de plazos (regla de negocio N°4).
export const SEMAFORO = {
  'en-plazo':    { icono: '🟢', label: 'En plazo',          color: '#10b981', clase: 'plazo-en-plazo' },
  'por-vencer':  { icono: '🟡', label: 'Próximo a vencer',  color: '#f59e0b', clase: 'plazo-por-vencer' },
  'vencido':     { icono: '🔴', label: 'Plazo vencido',     color: '#ef4444', clase: 'plazo-vencido' },
  'sin-plazo':   { icono: '🔵', label: 'Sin plazo especial', color: '#3b82f6', clase: 'plazo-sin-plazo' },
  'finalizado':  { icono: '⚫', label: 'Finalizado',        color: '#64748b', clase: 'plazo-finalizado' },
};

// Tipos de evento del historial (regla de negocio N°9).
export const TIPOS_HISTORIAL = {
  CREACION: 'creacion',
  ESTADO: 'cambio-estado',
  ETAPA: 'etapa',
  DERIVACION: 'derivacion',
  PLAZO: 'cambio-plazo',
  PRIORIDAD: 'cambio-prioridad',
  OBSERVACION: 'observacion',
  RECTORIA: 'entrega-rectoria',
  FINALIZACION: 'finalizacion',
  EDICION: 'edicion',
};

// Crea una etapa de seguimiento vacía para una unidad.
export function crearEtapa(unidadId, orden = 0) {
  return {
    unidad: unidadId,
    orden,
    fechaInicio: '',
    fechaTermino: '',
    estado: 'Pendiente',
    observaciones: '',
  };
}

// Crea el set de etapas de un flujo (por defecto o personalizado).
export function crearEtapas(flujo = FLUJO_POR_DEFECTO) {
  return flujo.map((unidadId, i) => crearEtapa(unidadId, i));
}

// Convenio nuevo con valores por defecto seguros.
export function crearConvenio(datos = {}) {
  return {
    id: datos.id,
    codigo: datos.codigo || '',
    nombre: datos.nombre || '',
    unidadOrigen: datos.unidadOrigen || '',
    contraparte: datos.contraparte || '',
    tipo: datos.tipo || '',
    fechaIngreso: datos.fechaIngreso || '',
    fechaEntregaRectoria: datos.fechaEntregaRectoria || '',
    estado: datos.estado || 'Ingresado',
    prioridad: datos.prioridad || 'normal',
    motivoPrioridad: datos.motivoPrioridad || '',
    plazoEspecial: Boolean(datos.plazoEspecial),
    fechaLimite: datos.fechaLimite || '',
    observaciones: datos.observaciones || '',
    etapas: datos.etapas || crearEtapas(),
    historial: datos.historial || [],
    adjuntos: datos.adjuntos || [],
  };
}

// Normaliza un convenio venido de la BD o de localStorage para que la UI nunca
// tenga que defenderse de campos ausentes.
export function normalizarConvenio(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const etapas = Array.isArray(raw.etapas) && raw.etapas.length > 0
    ? raw.etapas.map((e, i) => ({ ...crearEtapa(e.unidad, i), ...e, orden: Number.isFinite(e.orden) ? e.orden : i }))
    : crearEtapas();

  // Una unidad no puede aparecer dos veces en el mismo flujo. Los formularios
  // ya lo impiden y la planilla también, pero un respaldo JSON editado a mano sí
  // puede traerlas repetidas, y entonces calcularEventos —que indexa las etapas
  // por unidad— comparaba una contra otra y anotaba en el historial un cambio de
  // estado que nadie hizo. Se conserva la primera del flujo.
  const vistas = new Set();
  const unicas = [...etapas]
    .sort((a, b) => a.orden - b.orden)
    .filter(e => {
      if (vistas.has(e.unidad)) return false;
      vistas.add(e.unidad);
      return true;
    });

  return {
    ...crearConvenio(raw),
    etapas: unicas,
    historial: Array.isArray(raw.historial) ? raw.historial : [],
    adjuntos: Array.isArray(raw.adjuntos) ? raw.adjuntos : [],
  };
}
