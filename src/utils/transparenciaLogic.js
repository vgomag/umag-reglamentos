// Cálculo de plazos legales y estado de las solicitudes de acceso a la
// información (Ley 20.285). Todo el módulo es puro y testeable.

import {
  PLAZOS_LEY_20285, ESTADOS_SOLICITUD_CERRADOS,
} from '../config/transparencia';
import {
  sumarDiasHabiles, diasHabilesHasta, esFechaValida, hoyISO,
  feriadosCubrenRango, ultimoAnioConFeriados,
} from './fechas';

// Umbral (en días hábiles) para marcar la solicitud como próxima a vencer.
export const DIAS_HABILES_ALERTA = 5;

export const AVISO_FERIADOS_INCOMPLETOS =
  'Este plazo cae en un año para el que la tabla de feriados está incompleta. '
  + 'Los feriados que falten se contaron como días hábiles, así que la fecha real '
  + 'puede ser posterior a la que se muestra: verifícala antes de responder.';

export function solicitudCerrada(solicitud) {
  return ESTADOS_SOLICITUD_CERRADOS.includes(solicitud?.estado);
}

// Fecha máxima de respuesta: 20 días hábiles desde el ingreso (Art. 14),
// más 10 días hábiles adicionales si se comunicó la prórroga.
export function fechaVencimiento(solicitud) {
  if (!solicitud || !esFechaValida(solicitud.fechaIngreso)) return '';
  const base = sumarDiasHabiles(solicitud.fechaIngreso, PLAZOS_LEY_20285.RESPUESTA.dias);
  if (!solicitud.prorrogada) return base;
  return sumarDiasHabiles(base, PLAZOS_LEY_20285.PRORROGA.dias);
}

// Fecha tope para que el solicitante subsane (Art. 12): 5 días hábiles.
export function fechaTopeSubsanacion(solicitud) {
  if (!solicitud?.subsanacionSolicitada || !esFechaValida(solicitud.fechaSubsanacion)) return '';
  return sumarDiasHabiles(solicitud.fechaSubsanacion, PLAZOS_LEY_20285.SUBSANACION.dias);
}

// Fecha tope para que un tercero se oponga (Art. 20): 3 días hábiles desde
// la notificación, que debe hacerse dentro de 2 días hábiles del ingreso.
export function fechaTopeOposicion(solicitud) {
  if (!solicitud?.terceroInvolucrado || !esFechaValida(solicitud.fechaIngreso)) return '';
  const notificacion = sumarDiasHabiles(solicitud.fechaIngreso, PLAZOS_LEY_20285.NOTIFICACION_TERCERO.dias);
  return sumarDiasHabiles(notificacion, PLAZOS_LEY_20285.OPOSICION_TERCERO.dias);
}

// Fecha tope del solicitante para recurrir de amparo ante el CPLT (Art. 24).
export function fechaTopeAmparo(solicitud) {
  const referencia = solicitud?.fechaRespuesta || fechaVencimiento(solicitud);
  if (!esFechaValida(referencia)) return '';
  return sumarDiasHabiles(referencia, PLAZOS_LEY_20285.AMPARO.dias);
}

/**
 * ¿El cálculo de este plazo se apoyó sólo en años cuyos feriados conocemos?
 *
 * Si devuelve false la fecha calculada NO es de fiar: los feriados que la tabla
 * no tiene se contaron como hábiles, así que el vencimiento real es igual o
 * posterior al que muestra la app. Se marca en pantalla en vez de disimularlo.
 */
export function plazoConFeriadosCompletos(solicitud) {
  const vencimiento = fechaVencimiento(solicitud);
  if (!vencimiento) return true;
  return feriadosCubrenRango(solicitud?.fechaIngreso, vencimiento);
}

// Año hasta el que la app sabe contar días hábiles. Lo usa Configuración para
// avisar con tiempo de que hay que cargar los feriados del año siguiente.
export function anioLimiteDeCalculo() {
  return ultimoAnioConFeriados();
}

// Semáforo equivalente al de convenios, pero contado en días hábiles.
export function infoPlazoSolicitud(solicitud, referencia = hoyISO()) {
  const vencimiento = fechaVencimiento(solicitud);
  // Se calcula siempre: importa igual si la solicitud está cerrada, porque el
  // plazo de amparo del solicitante se cuenta desde esta misma fecha.
  const feriadosIncompletos = !plazoConFeriadosCompletos(solicitud);
  const info = (datos) => ({ ...datos, feriadosIncompletos });

  if (solicitudCerrada(solicitud)) {
    return info({ key: 'finalizado', icono: '⚫', label: 'Cerrada', color: '#64748b', vencimiento, diasHabiles: null });
  }
  if (!vencimiento) {
    return info({ key: 'sin-plazo', icono: '🔵', label: 'Sin fecha de ingreso', color: '#3b82f6', vencimiento: '', diasHabiles: null });
  }
  const dias = diasHabilesHasta(vencimiento, referencia);
  if (dias === null) {
    return info({ key: 'sin-plazo', icono: '🔵', label: 'Sin plazo calculable', color: '#3b82f6', vencimiento, diasHabiles: null });
  }
  if (dias < 0) return info({ key: 'vencido', icono: '🔴', label: 'Plazo vencido', color: '#ef4444', vencimiento, diasHabiles: dias });
  if (dias <= DIAS_HABILES_ALERTA) return info({ key: 'por-vencer', icono: '🟡', label: 'Próximo a vencer', color: '#f59e0b', vencimiento, diasHabiles: dias });
  return info({ key: 'en-plazo', icono: '🟢', label: 'En plazo', color: '#10b981', vencimiento, diasHabiles: dias });
}

export function textoPlazoSolicitud(solicitud, referencia = hoyISO()) {
  const info = infoPlazoSolicitud(solicitud, referencia);
  if (info.diasHabiles === null) return info.label;
  if (info.diasHabiles < 0) return `Vencido hace ${Math.abs(info.diasHabiles)} día(s) hábil(es)`;
  if (info.diasHabiles === 0) return 'Vence hoy';
  return `Faltan ${info.diasHabiles} día(s) hábil(es)`;
}

// Devuelve la solicitud con su fecha de vencimiento ya calculada, que es lo
// que consumen el calendario y las listas.
export function conVencimiento(solicitud) {
  return { ...solicitud, fechaVencimiento: fechaVencimiento(solicitud) };
}

export function resumenSolicitudes(solicitudes = [], referencia = hoyISO()) {
  const total = solicitudes.length;
  const cerradas = solicitudes.filter(solicitudCerrada).length;
  const enTramite = total - cerradas;
  const vencidas = solicitudes.filter(s => infoPlazoSolicitud(s, referencia).key === 'vencido').length;
  const porVencer = solicitudes.filter(s => infoPlazoSolicitud(s, referencia).key === 'por-vencer').length;
  const prorrogadas = solicitudes.filter(s => s.prorrogada && !solicitudCerrada(s)).length;
  const respondidas = solicitudes.filter(s => s.estado === 'Respondida').length;
  return { total, cerradas, enTramite, vencidas, porVencer, prorrogadas, respondidas };
}

const normalizar = (s) => (s || '').toString().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function filtrarSolicitudes(solicitudes = [], filtros = {}, referencia = hoyISO()) {
  const { busqueda = '', estado = '', etapa = '', plazo = '', situacion = '' } = filtros;
  const q = normalizar(busqueda);
  return solicitudes.filter(s => {
    if (q) {
      const heno = [s.codigo, s.solicitante, s.materia, s.unidadDerivada, s.observaciones].map(normalizar).join(' ');
      if (!heno.includes(q)) return false;
    }
    if (estado && s.estado !== estado) return false;
    if (etapa && s.etapa !== etapa) return false;
    if (plazo && infoPlazoSolicitud(s, referencia).key !== plazo) return false;
    if (situacion === 'pendientes' && solicitudCerrada(s)) return false;
    if (situacion === 'cerradas' && !solicitudCerrada(s)) return false;
    return true;
  });
}

// Orden por defecto: las que vencen antes, primero (el criterio de trabajo
// del encargado es el vencimiento legal, no la fecha de llegada).
export function ordenarSolicitudes(solicitudes = [], criterio = 'vencimiento') {
  const lista = [...solicitudes];
  if (criterio === 'ingreso') {
    return lista.sort((a, b) => (a.fechaIngreso || '').localeCompare(b.fechaIngreso || ''));
  }
  if (criterio === 'codigo') {
    return lista.sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''));
  }
  return lista.sort((a, b) => {
    const va = fechaVencimiento(a) || '9999-12-31';
    const vb = fechaVencimiento(b) || '9999-12-31';
    return va.localeCompare(vb);
  });
}
