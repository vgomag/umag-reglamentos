// Cálculo de plazos legales y estado de las solicitudes de acceso a la
// información (Ley 20.285). Todo el módulo es puro y testeable.

import {
  PLAZOS_LEY_20285, ESTADOS_SOLICITUD_CERRADOS,
} from '../config/transparencia';
import {
  sumarDiasHabiles, diasHabilesHasta, diasHabilesEntre, esFechaValida, hoyISO,
  feriadosCubrenRango, ultimoAnioConFeriados,
} from './fechas';

// Umbral (en días hábiles) para marcar la solicitud como próxima a vencer.
export const DIAS_HABILES_ALERTA = 5;

export const AVISO_FERIADOS_INCOMPLETOS =
  'Este plazo cae en un año para el que la tabla de feriados está incompleta. '
  + 'Los feriados que falten se contaron como días hábiles, así que la fecha real '
  + 'puede ser posterior a la que se muestra: verifícala antes de responder.';

// Cerrada para el trámite: ya no está sobre el escritorio de nadie.
export function solicitudCerrada(solicitud) {
  return ESTADOS_SOLICITUD_CERRADOS.includes(solicitud?.estado);
}

/**
 * ¿Se respondió?
 *
 * El plazo del Art. 14 se cumple RESPONDIENDO antes de la fecha tope, no
 * cambiando un estado en esta aplicación. Son dos cosas distintas y hasta ahora
 * el semáforo sólo miraba el estado: una solicitud respondida dentro de plazo a
 * la que se le olvidó cambiar el estado aparecía como "Plazo vencido" y engrosaba
 * el contador de vencidas. Es decir, el sistema reportaba un incumplimiento legal
 * que no había ocurrido, mientras su propio historial anotaba "Respuesta enviada".
 */
export function solicitudRespondida(solicitud) {
  return esFechaValida(solicitud?.fechaRespuesta);
}

// Días hábiles de margen entre la respuesta y la fecha tope. Positivo si se
// respondió antes, negativo si se pasó. null si falta alguna de las dos fechas.
export function margenDeRespuesta(solicitud) {
  const vencimiento = fechaVencimiento(solicitud);
  if (!solicitudRespondida(solicitud) || !esFechaValida(vencimiento)) return null;
  return diasHabilesEntre(solicitud.fechaRespuesta, vencimiento);
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

  // Se mira ANTES que el estado: si hay respuesta, el plazo legal ya se
  // resolvió, y lo que importa es si se resolvió a tiempo o no.
  if (solicitudRespondida(solicitud)) {
    const margen = margenDeRespuesta(solicitud);
    if (margen === null || margen >= 0) {
      return info({ key: 'respondida', icono: '✅', label: 'Respondida en plazo', color: '#10b981', vencimiento, diasHabiles: margen });
    }
    // Se responde igual, pero fuera de plazo: es un hecho que el registro de
    // cumplimiento no debe perder.
    return info({ key: 'fuera-de-plazo', icono: '🔴', label: 'Respondida fuera de plazo', color: '#ef4444', vencimiento, diasHabiles: margen });
  }

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

  // Una vez respondida, los días que quedaban dejan de ser una cuenta atrás y
  // pasan a ser el margen con que se cumplió (o el retraso con que no).
  if (info.key === 'respondida') {
    // Sin fecha de ingreso no hay vencimiento contra el que medir el margen.
    if (info.diasHabiles === null) return 'Respondida';
    if (info.diasHabiles === 0) return 'Respondida el último día del plazo';
    return `Respondida con ${info.diasHabiles} día(s) hábil(es) de margen`;
  }
  if (info.key === 'fuera-de-plazo') {
    return `Respondida ${Math.abs(info.diasHabiles)} día(s) hábil(es) después del vencimiento`;
  }

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
  // `vencidas` son las que siguen SIN responder pasado el plazo: las accionables.
  // Las que se respondieron tarde salen aparte, en `fueraDePlazo`, porque ya no
  // hay nada que hacer con ellas pero el incumplimiento no debe desaparecer.
  const vencidas = solicitudes.filter(s => infoPlazoSolicitud(s, referencia).key === 'vencido').length;
  const fueraDePlazo = solicitudes.filter(s => infoPlazoSolicitud(s, referencia).key === 'fuera-de-plazo').length;
  const porVencer = solicitudes.filter(s => infoPlazoSolicitud(s, referencia).key === 'por-vencer').length;
  const prorrogadas = solicitudes.filter(s => s.prorrogada && !solicitudCerrada(s)).length;
  // Cuenta las dos formas de decir lo mismo: la fecha de respuesta y el estado.
  const respondidas = solicitudes.filter(s => solicitudRespondida(s) || s.estado === 'Respondida').length;
  return { total, cerradas, enTramite, vencidas, fueraDePlazo, porVencer, prorrogadas, respondidas };
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
