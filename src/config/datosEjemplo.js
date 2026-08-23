// Datos de ejemplo para probar la aplicación.
//
// NO se cargan automáticamente: el encargado los pide desde Configuración.
// Así la app arranca vacía y nunca se confunden con convenios reales.
//
// Las fechas se generan RELATIVAS a la fecha de carga, para que el semáforo
// muestre siempre casos vigentes (uno vencido, uno por vencer, etc.) y los
// ejemplos no queden obsoletos con el paso del tiempo.

import { crearConvenio, crearEtapas, normalizarConvenio, TIPOS_HISTORIAL } from './convenios';
import { crearSolicitud, normalizarSolicitud } from './transparencia';
import { hoyISO, sumarDias, esDiaHabil } from '../utils/fechas';

// Prefijo que identifica un registro de ejemplo; permite borrarlos después
// sin tocar los convenios reales.
export const PREFIJO_EJEMPLO = 'EJ-';

export const AVISO_EJEMPLO = '⚠️ Registro de ejemplo, creado para probar el sistema. Puede eliminarse desde Configuración.';

export function esRegistroEjemplo(registro) {
  return typeof registro?.codigo === 'string' && registro.codigo.startsWith(PREFIJO_EJEMPLO);
}

// Construye el historial mínimo de un convenio de ejemplo.
// `base` es la fecha de hoy: los offsets de cada entrada son relativos a ella,
// igual que las fechas de ingreso y de las etapas.
function historial(entradas, base) {
  return entradas.map(([dias, tipo, descripcion], i) => ({
    id: `ejemplo-${base}-${i}`,
    // Marca de tiempo al mediodía, para que el orden del historial sea estable.
    fecha: `${sumarDias(base, dias)}T12:00:00.000Z`,
    tipo,
    descripcion,
    usuario: 'Datos de ejemplo',
  }));
}

// Aplica estado y fechas a las etapas indicadas, dejando el resto intacto.
function conEtapas(flujo, avances) {
  return crearEtapas(flujo).map(etapa => ({ ...etapa, ...(avances[etapa.unidad] || {}) }));
}

/**
 * Ocho convenios que cubren todos los estados del semáforo y todas las
 * ubicaciones del flujo, para que cada vista tenga algo que mostrar.
 */
export function generarConveniosEjemplo(hoy = hoyISO()) {
  const d = (dias) => sumarDias(hoy, dias);

  const definiciones = [
    {
      codigo: 'EJ-001',
      nombre: 'Convenio marco con Hospital Clínico de Magallanes',
      unidadOrigen: 'Facultad de Ciencias de la Salud',
      contraparte: 'Hospital Clínico de Magallanes',
      tipo: 'Convenio marco',
      fechaIngreso: d(-52),
      estado: 'En Tramitación',
      observaciones: 'Campos clínicos para las carreras de la Facultad. Pendiente informe de VRAF sobre costos asociados.',
      flujo: ['VRAC', 'VRAF', 'PRO', 'CONTRALORIA', 'RECTORIA'],
      // Lleva más de 15 días en VRAF: la vista de Seguimiento lo marca en ámbar.
      avances: {
        VRAC: { estado: 'Aprobado', fechaInicio: d(-50), fechaTermino: d(-33) },
        VRAF: { estado: 'En Revisión', fechaInicio: d(-31), observaciones: 'Revisando compromiso presupuestario.' },
      },
      eventos: [
        [-52, TIPOS_HISTORIAL.CREACION, 'Convenio ingresado al sistema'],
        [-50, TIPOS_HISTORIAL.DERIVACION, 'VRAC recibió el convenio'],
        [-33, TIPOS_HISTORIAL.ETAPA, 'VRAC: En Revisión → Aprobado'],
        [-31, TIPOS_HISTORIAL.DERIVACION, 'VRAF recibió el convenio'],
      ],
    },
    {
      codigo: 'EJ-002',
      nombre: 'Convenio de investigación antártica con INACH',
      unidadOrigen: 'VRIIP',
      contraparte: 'Instituto Antártico Chileno',
      tipo: 'Investigación',
      fechaIngreso: d(-74),
      // Plazo vencido: aparece en 🔴 y encabeza "Requieren atención inmediata".
      fechaLimite: d(-6),
      plazoEspecial: true,
      prioridad: 'urgente',
      motivoPrioridad: 'Postulación a fondo concursable con fecha de cierre',
      estado: 'Observado',
      observaciones: 'Contraloría devolvió con observaciones sobre la cláusula de propiedad intelectual.',
      flujo: ['VRIIP', 'VRAF', 'PRO', 'CONTRALORIA', 'RECTORIA'],
      avances: {
        VRIIP: { estado: 'Aprobado', fechaInicio: d(-72), fechaTermino: d(-58) },
        VRAF: { estado: 'Aprobado', fechaInicio: d(-57), fechaTermino: d(-40) },
        PRO: { estado: 'Aprobado', fechaInicio: d(-38), fechaTermino: d(-25) },
        CONTRALORIA: { estado: 'Observado', fechaInicio: d(-22), observaciones: 'Ajustar cláusula 7 sobre propiedad intelectual.' },
      },
      eventos: [
        [-74, TIPOS_HISTORIAL.CREACION, 'Convenio ingresado al sistema'],
        [-74, TIPOS_HISTORIAL.PRIORIDAD, 'Prioridad: normal → urgente (postulación a fondo concursable)'],
        [-58, TIPOS_HISTORIAL.ETAPA, 'VRIIP terminó su revisión'],
        [-40, TIPOS_HISTORIAL.ETAPA, 'VRAF terminó su revisión'],
        [-22, TIPOS_HISTORIAL.OBSERVACION, 'Observación de Contraloría: ajustar cláusula 7'],
      ],
    },
    {
      codigo: 'EJ-003',
      nombre: 'Convenio de práctica profesional con INACAP',
      unidadOrigen: 'Facultad de Ingeniería',
      contraparte: 'INACAP sede Punta Arenas',
      tipo: 'Práctica profesional',
      fechaIngreso: d(-27),
      // Dentro del umbral de alerta: 🟡 próximo a vencer.
      fechaLimite: d(4),
      plazoEspecial: true,
      prioridad: 'alta',
      motivoPrioridad: 'Debe estar firmado antes del inicio del semestre',
      estado: 'En Tramitación',
      observaciones: 'Prácticas del segundo semestre. VVM no participa.',
      flujo: ['VRAC', 'VRAF', 'PRO', 'CONTRALORIA', 'RECTORIA'],
      avances: {
        VRAC: { estado: 'Aprobado', fechaInicio: d(-25), fechaTermino: d(-12) },
        VRAF: { estado: 'En Revisión', fechaInicio: d(-10) },
      },
      eventos: [
        [-27, TIPOS_HISTORIAL.CREACION, 'Convenio ingresado al sistema'],
        [-27, TIPOS_HISTORIAL.PLAZO, 'Fecha límite: sin plazo → fecha comprometida con la contraparte'],
        [-12, TIPOS_HISTORIAL.ETAPA, 'VRAC terminó su revisión'],
        [-10, TIPOS_HISTORIAL.DERIVACION, 'VRAF recibió el convenio'],
      ],
    },
    {
      codigo: 'EJ-004',
      nombre: 'Convenio de vinculación con Municipalidad de Punta Arenas',
      unidadOrigen: 'VVM',
      contraparte: 'Ilustre Municipalidad de Punta Arenas',
      tipo: 'Vinculación con el medio',
      fechaIngreso: d(-19),
      // Con plazo holgado: 🟢 en plazo.
      fechaLimite: d(45),
      plazoEspecial: true,
      estado: 'En Tramitación',
      observaciones: 'Programa de extensión cultural en barrios. Sin compromiso de recursos, VRAF no participa.',
      flujo: ['VVM', 'PRO', 'CONTRALORIA', 'RECTORIA'],
      avances: {
        VVM: { estado: 'En Revisión', fechaInicio: d(-16) },
      },
      eventos: [
        [-19, TIPOS_HISTORIAL.CREACION, 'Convenio ingresado al sistema'],
        [-16, TIPOS_HISTORIAL.DERIVACION, 'VVM recibió el convenio'],
      ],
    },
    {
      codigo: 'EJ-005',
      nombre: 'Convenio de movilidad estudiantil con Universidad de Chile',
      unidadOrigen: 'VRAC',
      contraparte: 'Universidad de Chile',
      tipo: 'Colaboración académica',
      fechaIngreso: d(-4),
      estado: 'Ingresado',
      // Recién ingresado y sin derivar: aparece en la columna "Ingresado".
      observaciones: 'Recibido en Secretaría General. Falta definir qué vicerrectorías deben visar.',
      flujo: ['VRAC', 'PRO', 'CONTRALORIA', 'RECTORIA'],
      avances: {},
      eventos: [[-4, TIPOS_HISTORIAL.CREACION, 'Convenio ingresado al sistema']],
    },
    {
      codigo: 'EJ-006',
      nombre: 'Convenio de prestación de servicios odontológicos',
      unidadOrigen: 'Facultad de Ciencias de la Salud',
      contraparte: 'Servicio de Salud Magallanes',
      tipo: 'Prestación de servicios',
      fechaIngreso: d(-40),
      estado: 'En Tramitación',
      observaciones: 'En toma de razón interna.',
      flujo: ['VRAC', 'VRAF', 'PRO', 'CONTRALORIA', 'RECTORIA'],
      avances: {
        VRAC: { estado: 'Aprobado', fechaInicio: d(-38), fechaTermino: d(-30) },
        VRAF: { estado: 'Aprobado', fechaInicio: d(-29), fechaTermino: d(-18) },
        PRO: { estado: 'Aprobado', fechaInicio: d(-17), fechaTermino: d(-8) },
        CONTRALORIA: { estado: 'En Revisión', fechaInicio: d(-6) },
      },
      eventos: [
        [-40, TIPOS_HISTORIAL.CREACION, 'Convenio ingresado al sistema'],
        [-18, TIPOS_HISTORIAL.ETAPA, 'VRAF terminó su revisión'],
        [-6, TIPOS_HISTORIAL.DERIVACION, 'Contraloría recibió el convenio'],
      ],
    },
    {
      codigo: 'EJ-007',
      nombre: 'Convenio de cooperación técnica con SERNAPESCA',
      unidadOrigen: 'Prorrectoría',
      contraparte: 'Servicio Nacional de Pesca y Acuicultura',
      tipo: 'Convenio específico',
      fechaIngreso: d(-111),
      // Ya entregado a Rectoría y esperando firma.
      fechaEntregaRectoria: d(-11),
      estado: 'Pendiente Rectoría',
      observaciones: 'Entregado a Rectoría para firma. Se espera decreto en las próximas semanas.',
      flujo: ['VRIIP', 'VRAF', 'PRO', 'CONTRALORIA', 'RECTORIA'],
      avances: {
        VRIIP: { estado: 'Aprobado', fechaInicio: d(-108), fechaTermino: d(-88) },
        VRAF: { estado: 'Aprobado', fechaInicio: d(-86), fechaTermino: d(-64) },
        PRO: { estado: 'Aprobado', fechaInicio: d(-62), fechaTermino: d(-41) },
        CONTRALORIA: { estado: 'Aprobado', fechaInicio: d(-39), fechaTermino: d(-14) },
        RECTORIA: { estado: 'En Revisión', fechaInicio: d(-11) },
      },
      eventos: [
        [-111, TIPOS_HISTORIAL.CREACION, 'Convenio ingresado al sistema'],
        [-14, TIPOS_HISTORIAL.ETAPA, 'Contraloría terminó su revisión'],
        [-11, TIPOS_HISTORIAL.RECTORIA, 'Entregado a Rectoría'],
      ],
    },
    {
      codigo: 'EJ-008',
      nombre: 'Convenio marco con Universidad de Aysén',
      unidadOrigen: 'VRIIP',
      contraparte: 'Universidad de Aysén',
      tipo: 'Convenio marco',
      fechaIngreso: d(-165),
      fechaEntregaRectoria: d(-64),
      estado: 'Finalizado',
      observaciones: 'Tramitación cerrada. Decreto firmado y comunicado a las unidades.',
      flujo: ['VRIIP', 'VRAC', 'PRO', 'CONTRALORIA', 'RECTORIA'],
      avances: {
        VRIIP: { estado: 'Aprobado', fechaInicio: d(-162), fechaTermino: d(-141) },
        VRAC: { estado: 'Aprobado', fechaInicio: d(-139), fechaTermino: d(-118) },
        PRO: { estado: 'Aprobado', fechaInicio: d(-116), fechaTermino: d(-95) },
        CONTRALORIA: { estado: 'Aprobado', fechaInicio: d(-93), fechaTermino: d(-70) },
        RECTORIA: { estado: 'Aprobado', fechaInicio: d(-64), fechaTermino: d(-52) },
      },
      eventos: [
        [-165, TIPOS_HISTORIAL.CREACION, 'Convenio ingresado al sistema'],
        [-64, TIPOS_HISTORIAL.RECTORIA, 'Entregado a Rectoría'],
        [-52, TIPOS_HISTORIAL.FINALIZACION, 'Convenio finalizado'],
      ],
    },
  ];

  return definiciones.map((def, i) => normalizarConvenio(crearConvenio({
    ...def,
    id: i + 1,
    observaciones: `${AVISO_EJEMPLO}\n\n${def.observaciones}`,
    etapas: conEtapas(def.flujo, def.avances),
    historial: historial(def.eventos, hoy),
  })));
}

/**
 * Cuatro solicitudes de transparencia que cubren los estados de plazo:
 * vencida, próxima a vencer, prorrogada y respondida.
 */
export function generarSolicitudesEjemplo(hoy = hoyISO()) {
  // Espejo de sumarDiasHabiles: retrocede hasta acumular `n` días hábiles.
  // Con `hoy` hábil se cumple diasHabilesEntre(resultado, hoy) === n.
  const haceHabiles = (n) => {
    let cursor = hoy;
    let restantes = n;
    while (restantes > 0) {
      cursor = sumarDias(cursor, -1);
      if (esDiaHabil(cursor)) restantes--;
    }
    return cursor;
  };

  const definiciones = [
    {
      codigo: 'EJ-UN016T0000633',
      // 24 días hábiles atrás: el plazo de 20 días del Art. 14 ya se cumplió.
      fechaIngreso: haceHabiles(24),
      solicitante: 'Solicitante de ejemplo 1',
      email: 'ejemplo1@correo.cl',
      viaIngreso: 'Portal de Transparencia',
      materia: 'Copia del protocolo institucional de prevención y abordaje de la violencia de género y acoso sexual vigente, cantidad de denuncias y medidas adoptadas.',
      unidadDerivada: 'Prorrectoría',
      etapa: 'Análisis y búsqueda',
      estado: 'En búsqueda de información',
      formatoEntrega: 'Electrónico/Word',
    },
    {
      codigo: 'EJ-UN016T0000701',
      // 17 días hábiles atrás: quedan 3, dentro del umbral de alerta.
      fechaIngreso: haceHabiles(17),
      solicitante: 'Solicitante de ejemplo 2',
      email: 'ejemplo2@correo.cl',
      viaIngreso: 'Oficina de Partes',
      materia: 'Nómina del personal a contrata del año en curso, con grado y estamento.',
      unidadDerivada: 'VRAF',
      etapa: 'Análisis y búsqueda',
      estado: 'En análisis de admisibilidad',
      formatoEntrega: 'Electrónico/Excel',
    },
    {
      codigo: 'EJ-UN016T0000742',
      // Prorrogada: 22 hábiles transcurridos, pero el plazo es 20 + 10.
      fechaIngreso: haceHabiles(22),
      solicitante: 'Solicitante de ejemplo 3',
      email: 'ejemplo3@correo.cl',
      viaIngreso: 'Portal de Transparencia',
      materia: 'Detalle de convenios suscritos por la Universidad en los últimos tres años.',
      unidadDerivada: 'Contraloría',
      etapa: 'Análisis y búsqueda',
      estado: 'Prorrogada',
      prorrogada: true,
      terceroInvolucrado: true,
      formatoEntrega: 'Electrónico/PDF',
    },
    {
      codigo: 'EJ-UN016T0000688',
      fechaIngreso: haceHabiles(30),
      solicitante: 'Solicitante de ejemplo 4',
      email: 'ejemplo4@correo.cl',
      viaIngreso: 'Portal de Transparencia',
      materia: 'Presupuesto institucional aprobado para el año en curso.',
      unidadDerivada: 'VRAF',
      etapa: 'Cerrada',
      estado: 'Respondida',
      fechaRespuesta: haceHabiles(12),
      formatoEntrega: 'Electrónico/PDF',
    },
  ];

  return definiciones.map((def, i) => normalizarSolicitud(crearSolicitud({
    ...def,
    id: i + 1,
    tipoPersona: 'Natural',
    observaciones: AVISO_EJEMPLO,
    historial: [{
      id: `ejemplo-sai-${i}`,
      fecha: `${def.fechaIngreso}T12:00:00.000Z`,
      tipo: TIPOS_HISTORIAL.CREACION,
      descripcion: 'Solicitud ingresada al sistema',
      usuario: 'Datos de ejemplo',
    }],
  })));
}
