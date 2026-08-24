// Lógica derivada de convenios: semáforo de plazos, ubicación actual,
// filtros, ordenamiento, historial y métricas del dashboard.
//
// Todo lo de este archivo es puro (sin React ni acceso a red) para poder
// testearlo y reutilizarlo desde cualquier vista.

import {
  SEMAFORO, ESTADOS_CERRADOS, ESTADOS_ETAPA_ACTIVA, DIAS_ALERTA_VENCIMIENTO,
  DIAS_INGRESO_RECIENTE, UNIDAD_IDS, TIPOS_HISTORIAL, nombreUnidad,
} from '../config/convenios';
import { hoyISO, diasHasta, esFechaValida, formatFecha } from './fechas';

export function estaCerrado(convenio) {
  return ESTADOS_CERRADOS.includes(convenio?.estado);
}

export function estaFinalizado(convenio) {
  return convenio?.estado === 'Finalizado';
}

export function tienePlazoEspecial(convenio) {
  return Boolean(convenio?.plazoEspecial || esFechaValida(convenio?.fechaLimite));
}

export function entregadoARectoria(convenio) {
  return esFechaValida(convenio?.fechaEntregaRectoria);
}

// Semáforo de plazos (regla de negocio N°4).
// Devuelve { key, icono, label, color, clase, diasRestantes, fechaLimite }.
export function infoPlazo(convenio, referencia = hoyISO()) {
  const base = (key, diasRestantes = null) => ({
    key, ...SEMAFORO[key], diasRestantes, fechaLimite: convenio?.fechaLimite || '',
  });
  if (!convenio) return base('sin-plazo');
  if (estaCerrado(convenio)) return base('finalizado');
  if (!esFechaValida(convenio.fechaLimite)) return base('sin-plazo');

  const dias = diasHasta(convenio.fechaLimite, referencia);
  if (dias === null) return base('sin-plazo');
  if (dias < 0) return base('vencido', dias);
  if (dias <= DIAS_ALERTA_VENCIMIENTO) return base('por-vencer', dias);
  return base('en-plazo', dias);
}

export function estadoPlazo(convenio, referencia = hoyISO()) {
  return infoPlazo(convenio, referencia).key;
}

// Texto corto para mostrar junto al semáforo.
export function textoPlazo(convenio, referencia = hoyISO()) {
  const info = infoPlazo(convenio, referencia);
  if (info.key === 'sin-plazo') return 'Sin plazo especial';
  if (info.key === 'finalizado') return estaFinalizado(convenio) ? 'Finalizado' : 'Cerrado';
  if (info.diasRestantes < 0) return `Vencido hace ${Math.abs(info.diasRestantes)} día(s)`;
  if (info.diasRestantes === 0) return 'Vence hoy';
  return `Faltan ${info.diasRestantes} día(s)`;
}

// Etapas que efectivamente participan (excluye las marcadas "No Aplica").
export function etapasActivas(convenio) {
  return (convenio?.etapas || []).filter(e => e.estado !== 'No Aplica');
}

// Etapa donde está el convenio ahora mismo: la primera en revisión u observada.
// Si ninguna está activa, se usa la primera pendiente (ya despachada o por despachar).
export function etapaActual(convenio) {
  const etapas = [...etapasActivas(convenio)].sort((a, b) => a.orden - b.orden);
  return etapas.find(e => ESTADOS_ETAPA_ACTIVA.includes(e.estado))
    || etapas.find(e => e.estado === 'Pendiente')
    || null;
}

// Identificador de ubicación: 'FINALIZADO' | 'INGRESADO' | id de unidad.
export function ubicacionActual(convenio) {
  if (estaFinalizado(convenio)) return 'FINALIZADO';
  const etapa = etapaActual(convenio);
  if (!etapa) return estaCerrado(convenio) ? 'FINALIZADO' : 'INGRESADO';
  if (etapa.estado === 'Pendiente' && !etapasActivas(convenio).some(e => e.estado !== 'Pendiente')) {
    return 'INGRESADO';
  }
  return etapa.unidad;
}

export function etiquetaUbicacion(convenio) {
  const ubic = ubicacionActual(convenio);
  if (ubic === 'FINALIZADO') return 'Finalizado';
  if (ubic === 'INGRESADO') return 'Ingresado';
  return nombreUnidad(ubic);
}

// Avance porcentual: etapas resueltas (Aprobado) sobre etapas que participan.
export function progresoConvenio(convenio) {
  if (estaFinalizado(convenio)) return 100;
  const activas = etapasActivas(convenio);
  if (activas.length === 0) return 0;
  const resueltas = activas.filter(e => e.estado === 'Aprobado').length;
  const enCurso = activas.filter(e => ESTADOS_ETAPA_ACTIVA.includes(e.estado)).length;
  return Math.min(99, Math.round(((resueltas + enCurso * 0.5) / activas.length) * 100));
}

// Un convenio "en trámite" es el que no está cerrado y ya salió del ingreso.
export function enTramite(convenio) {
  return !estaCerrado(convenio) && ubicacionActual(convenio) !== 'INGRESADO';
}

export function pendienteDeRectoria(convenio) {
  if (estaCerrado(convenio)) return false;
  if (convenio?.estado === 'Pendiente Rectoría') return true;
  return ubicacionActual(convenio) === 'RECTORIA';
}

export function ingresadoRecientemente(convenio, referencia = hoyISO()) {
  const dias = diasHasta(convenio?.fechaIngreso, referencia);
  return dias !== null && dias <= 0 && dias >= -DIAS_INGRESO_RECIENTE;
}

/* ------------------------------------------------------------------ */
/* Filtros y ordenamiento                                              */
/* ------------------------------------------------------------------ */

const normalizar = (s) => (s || '').toString().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const ORDENES = [
  { id: 'llegada', label: 'Orden de llegada (más antiguo primero)' },
  { id: 'ingreso-desc', label: 'Ingreso más reciente primero' },
  { id: 'urgencia', label: 'Urgencia (vencidos y prioridad primero)' },
  { id: 'limite', label: 'Fecha límite más próxima' },
  { id: 'entrega', label: 'Fecha de entrega a Rectoría' },
  { id: 'nombre', label: 'Nombre (A-Z)' },
  { id: 'unidad', label: 'Unidad de origen' },
];

const PESO_PLAZO = { vencido: 0, 'por-vencer': 1, 'en-plazo': 2, 'sin-plazo': 3, finalizado: 4 };
const PESO_PRIORIDAD = { urgente: 0, alta: 1, normal: 2 };

// Comparadores que dejan al final los valores vacíos en AMBAS direcciones:
// un convenio sin fecha nunca debe encabezar la lista, sólo quedar al final.
function compararFechas(a, b) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function compararFechasDesc(a, b) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a > b ? -1 : a < b ? 1 : 0;
}

export function ordenarConvenios(convenios, criterio = 'llegada', referencia = hoyISO()) {
  const lista = [...(convenios || [])];
  switch (criterio) {
    case 'ingreso-desc':
      return lista.sort((a, b) => compararFechasDesc(a.fechaIngreso, b.fechaIngreso));
    case 'urgencia':
      return lista.sort((a, b) => {
        const pa = PESO_PLAZO[estadoPlazo(a, referencia)] ?? 9;
        const pb = PESO_PLAZO[estadoPlazo(b, referencia)] ?? 9;
        if (pa !== pb) return pa - pb;
        const qa = PESO_PRIORIDAD[a.prioridad] ?? 2;
        const qb = PESO_PRIORIDAD[b.prioridad] ?? 2;
        if (qa !== qb) return qa - qb;
        return compararFechas(a.fechaIngreso, b.fechaIngreso);
      });
    case 'limite':
      return lista.sort((a, b) => compararFechas(a.fechaLimite, b.fechaLimite));
    case 'entrega':
      return lista.sort((a, b) => compararFechas(a.fechaEntregaRectoria, b.fechaEntregaRectoria));
    case 'nombre':
      return lista.sort((a, b) => normalizar(a.nombre).localeCompare(normalizar(b.nombre)));
    case 'unidad':
      return lista.sort((a, b) => normalizar(a.unidadOrigen).localeCompare(normalizar(b.unidadOrigen))
        || compararFechas(a.fechaIngreso, b.fechaIngreso));
    case 'llegada':
    default:
      // Criterio general de atención (regla de negocio N°1).
      return lista.sort((a, b) => compararFechas(a.fechaIngreso, b.fechaIngreso));
  }
}

export const FILTROS_VACIOS = {
  busqueda: '',
  estado: '',
  unidadOrigen: '',
  unidadActual: '',
  prioridad: '',
  ingresoDesde: '',
  ingresoHasta: '',
  entregaDesde: '',
  entregaHasta: '',
  plazo: '',        // '' | 'con-plazo' | 'sin-plazo' | 'vencido' | 'por-vencer'
  situacion: '',    // '' | 'pendientes' | 'finalizados' | 'en-tramite' | 'rectoria'
};

export function filtrarConvenios(convenios, filtros = {}, referencia = hoyISO()) {
  const f = { ...FILTROS_VACIOS, ...filtros };
  const q = normalizar(f.busqueda);

  return (convenios || []).filter(c => {
    if (q) {
      const heno = [c.nombre, c.codigo, c.unidadOrigen, c.contraparte, c.tipo, c.observaciones]
        .map(normalizar).join(' ');
      if (!heno.includes(q)) return false;
    }
    if (f.estado && c.estado !== f.estado) return false;
    if (f.unidadOrigen && c.unidadOrigen !== f.unidadOrigen) return false;
    if (f.unidadActual && ubicacionActual(c) !== f.unidadActual) return false;
    if (f.prioridad && c.prioridad !== f.prioridad) return false;
    if (f.ingresoDesde && (!c.fechaIngreso || c.fechaIngreso < f.ingresoDesde)) return false;
    if (f.ingresoHasta && (!c.fechaIngreso || c.fechaIngreso > f.ingresoHasta)) return false;
    if (f.entregaDesde && (!c.fechaEntregaRectoria || c.fechaEntregaRectoria < f.entregaDesde)) return false;
    if (f.entregaHasta && (!c.fechaEntregaRectoria || c.fechaEntregaRectoria > f.entregaHasta)) return false;

    if (f.plazo) {
      const key = estadoPlazo(c, referencia);
      if (f.plazo === 'con-plazo' && !tienePlazoEspecial(c)) return false;
      if (f.plazo === 'sin-plazo' && tienePlazoEspecial(c)) return false;
      if (f.plazo === 'vencido' && key !== 'vencido') return false;
      if (f.plazo === 'por-vencer' && key !== 'por-vencer') return false;
    }

    if (f.situacion === 'pendientes' && estaCerrado(c)) return false;
    if (f.situacion === 'finalizados' && !estaFinalizado(c)) return false;
    if (f.situacion === 'en-tramite' && !enTramite(c)) return false;
    if (f.situacion === 'rectoria' && !pendienteDeRectoria(c)) return false;

    return true;
  });
}

export function hayFiltrosActivos(filtros = {}) {
  return Object.keys(FILTROS_VACIOS).some(k => filtros[k]);
}

// Filtros que viven en el panel plegable de "Filtrar por fechas". Si alguno
// llega con valor hay que abrirlo, porque si no el listado aparece recortado
// por un criterio que no se ve en ninguna parte.
export const CAMPOS_FILTRO_AVANZADO = [
  'ingresoDesde', 'ingresoHasta', 'entregaDesde', 'entregaHasta', 'prioridad',
];

export function hayFiltrosAvanzados(filtros = {}) {
  return CAMPOS_FILTRO_AVANZADO.some(k => filtros[k]);
}

/* ------------------------------------------------------------------ */
/* Historial y trazabilidad (regla de negocio N°9)                     */
/* ------------------------------------------------------------------ */

export function crearEvento(tipo, descripcion, usuario = '') {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fecha: new Date().toISOString(),
    tipo,
    descripcion,
    usuario,
  };
}

export function agregarEvento(convenio, tipo, descripcion, usuario = '') {
  return {
    ...convenio,
    historial: [...(convenio.historial || []), crearEvento(tipo, descripcion, usuario)],
  };
}

const ETIQUETAS_CAMPO = {
  nombre: 'Nombre',
  codigo: 'Código',
  unidadOrigen: 'Unidad de origen',
  contraparte: 'Contraparte',
  tipo: 'Tipo',
  observaciones: 'Observaciones',
  motivoPrioridad: 'Motivo de prioridad',
};

// Compara dos versiones de un convenio y devuelve los eventos de historial que
// corresponde registrar. Así la trazabilidad no depende de que cada formulario
// se acuerde de anotar el cambio.
export function calcularEventos(anterior, actualizado, usuario = '') {
  const eventos = [];
  const push = (tipo, descripcion) => eventos.push(crearEvento(tipo, descripcion, usuario));
  if (!anterior) {
    push(TIPOS_HISTORIAL.CREACION, `Convenio ingresado${actualizado.fechaIngreso ? ` con fecha ${formatFecha(actualizado.fechaIngreso)}` : ''}`);
    return eventos;
  }

  if (anterior.estado !== actualizado.estado) {
    push(TIPOS_HISTORIAL.ESTADO, `Estado: ${anterior.estado} → ${actualizado.estado}`);
    if (actualizado.estado === 'Finalizado') {
      push(TIPOS_HISTORIAL.FINALIZACION, 'Convenio finalizado');
    }
  }

  if (anterior.prioridad !== actualizado.prioridad) {
    const motivo = actualizado.motivoPrioridad ? ` (${actualizado.motivoPrioridad})` : '';
    push(TIPOS_HISTORIAL.PRIORIDAD, `Prioridad: ${anterior.prioridad} → ${actualizado.prioridad}${motivo}`);
  }

  if (anterior.fechaLimite !== actualizado.fechaLimite) {
    const antes = anterior.fechaLimite ? formatFecha(anterior.fechaLimite) : 'sin plazo';
    const ahora = actualizado.fechaLimite ? formatFecha(actualizado.fechaLimite) : 'sin plazo';
    push(TIPOS_HISTORIAL.PLAZO, `Fecha límite: ${antes} → ${ahora}`);
  }

  if (anterior.fechaEntregaRectoria !== actualizado.fechaEntregaRectoria && actualizado.fechaEntregaRectoria) {
    push(TIPOS_HISTORIAL.RECTORIA, `Entregado a Rectoría el ${formatFecha(actualizado.fechaEntregaRectoria)}`);
  }

  if (anterior.fechaIngreso !== actualizado.fechaIngreso && actualizado.fechaIngreso) {
    push(TIPOS_HISTORIAL.EDICION, `Fecha de ingreso: ${anterior.fechaIngreso ? formatFecha(anterior.fechaIngreso) : '—'} → ${formatFecha(actualizado.fechaIngreso)}`);
  }

  Object.entries(ETIQUETAS_CAMPO).forEach(([campo, etiqueta]) => {
    if ((anterior[campo] || '') !== (actualizado[campo] || '')) {
      push(TIPOS_HISTORIAL.EDICION, `${etiqueta} actualizado`);
    }
  });

  // Cambios en las etapas de seguimiento.
  const previas = new Map((anterior.etapas || []).map(e => [e.unidad, e]));
  (actualizado.etapas || []).forEach(etapa => {
    const prev = previas.get(etapa.unidad);
    const unidad = nombreUnidad(etapa.unidad);
    if (!prev) {
      push(TIPOS_HISTORIAL.ETAPA, `Se agregó la etapa ${unidad} al flujo`);
      return;
    }
    if (prev.estado !== etapa.estado) {
      push(TIPOS_HISTORIAL.ETAPA, `${unidad}: ${prev.estado} → ${etapa.estado}`);
    }
    if (prev.fechaInicio !== etapa.fechaInicio && etapa.fechaInicio) {
      push(TIPOS_HISTORIAL.DERIVACION, `${unidad} recibió el convenio el ${formatFecha(etapa.fechaInicio)}`);
    }
    if (prev.fechaTermino !== etapa.fechaTermino && etapa.fechaTermino) {
      push(TIPOS_HISTORIAL.ETAPA, `${unidad} terminó su revisión el ${formatFecha(etapa.fechaTermino)}`);
    }
    if ((prev.observaciones || '') !== (etapa.observaciones || '') && etapa.observaciones) {
      push(TIPOS_HISTORIAL.OBSERVACION, `Observación de ${unidad}: ${etapa.observaciones.slice(0, 120)}`);
    }
  });

  (anterior.etapas || []).forEach(prev => {
    if (!(actualizado.etapas || []).some(e => e.unidad === prev.unidad)) {
      push(TIPOS_HISTORIAL.ETAPA, `Se quitó la etapa ${nombreUnidad(prev.unidad)} del flujo`);
    }
  });

  // Cambiar el orden de visación es una decisión sobre la tramitación, no un
  // detalle de presentación: se anota una sola vez con la secuencia resultante,
  // en vez de un evento por etapa movida.
  const secuencia = (etapas = []) => [...etapas]
    .sort((a, b) => a.orden - b.orden)
    .map(e => e.unidad)
    .join(' → ');
  const antes = secuencia(anterior.etapas);
  const ahora = secuencia(actualizado.etapas);
  if (antes !== ahora && mismasUnidades(anterior.etapas, actualizado.etapas)) {
    // Las comillas separan el antes del después: con una flecha entre ambos, la
    // frase quedaba "VRAC → VRAF → PRO → PRO → VRAC → VRAF" y no se entendía
    // dónde terminaba una secuencia y empezaba la otra.
    push(TIPOS_HISTORIAL.ETAPA, `Orden del flujo: «${ordenLegible(anterior.etapas)}» ahora es «${ordenLegible(actualizado.etapas)}»`);
  }

  return eventos;
}

// Si el conjunto de unidades cambió, lo que hubo fue un alta o una baja —ya
// anotadas arriba— y no un reordenamiento.
function mismasUnidades(a = [], b = []) {
  if (a.length !== b.length) return false;
  const unidadesB = new Set(b.map(e => e.unidad));
  return a.every(e => unidadesB.has(e.unidad));
}

function ordenLegible(etapas = []) {
  return [...etapas]
    .sort((a, b) => a.orden - b.orden)
    .map(e => nombreUnidad(e.unidad))
    .join(' → ');
}

// Devuelve el convenio actualizado con su historial ya enriquecido.
export function conHistorial(anterior, actualizado, usuario = '') {
  const eventos = calcularEventos(anterior, actualizado, usuario);
  if (eventos.length === 0) return actualizado;
  return { ...actualizado, historial: [...(actualizado.historial || []), ...eventos] };
}

/* ------------------------------------------------------------------ */
/* Métricas del dashboard                                              */
/* ------------------------------------------------------------------ */

export function resumenConvenios(convenios = [], referencia = hoyISO()) {
  const total = convenios.length;
  const finalizados = convenios.filter(estaFinalizado).length;
  const recientes = convenios.filter(c => ingresadoRecientemente(c, referencia)).length;
  const enTramiteN = convenios.filter(enTramite).length;
  const rectoria = convenios.filter(pendienteDeRectoria).length;
  const conPlazo = convenios.filter(c => tienePlazoEspecial(c) && !estaCerrado(c)).length;
  const porVencer = convenios.filter(c => estadoPlazo(c, referencia) === 'por-vencer').length;
  const vencidos = convenios.filter(c => estadoPlazo(c, referencia) === 'vencido').length;
  const pendientes = convenios.filter(c => !estaCerrado(c)).length;
  const entregados = convenios.filter(entregadoARectoria).length;
  return { total, finalizados, recientes, enTramite: enTramiteN, rectoria, conPlazo, porVencer, vencidos, pendientes, entregados };
}

// Cuántos convenios están hoy en cada unidad (incluye Ingresado y Finalizado).
export function pendientesPorUnidad(convenios = []) {
  const conteo = { INGRESADO: 0 };
  UNIDAD_IDS.forEach(id => { conteo[id] = 0; });
  convenios.forEach(c => {
    if (estaCerrado(c)) return;
    const ubic = ubicacionActual(c);
    if (ubic in conteo) conteo[ubic]++;
  });
  return conteo;
}

// Agrupa por unidad de origen para el módulo de reportes.
export function conteoPorCampo(convenios = [], campo) {
  const conteo = {};
  convenios.forEach(c => {
    const clave = c[campo] || 'Sin especificar';
    conteo[clave] = (conteo[clave] || 0) + 1;
  });
  return Object.entries(conteo).sort((a, b) => b[1] - a[1]);
}

// Tiempo promedio de tramitación en días corridos, sobre convenios finalizados.
export function tiempoPromedioTramitacion(convenios = []) {
  const cerrados = convenios.filter(c => estaFinalizado(c) && c.fechaIngreso);
  if (cerrados.length === 0) return null;
  const dias = cerrados.map(c => {
    const fin = c.fechaEntregaRectoria || [...(c.etapas || [])]
      .map(e => e.fechaTermino).filter(Boolean).sort().pop();
    if (!fin) return null;
    return diasHasta(fin, c.fechaIngreso);
  }).filter(d => d !== null && d >= 0);
  if (dias.length === 0) return null;
  return Math.round(dias.reduce((s, d) => s + d, 0) / dias.length);
}
