// Integración con Google Calendar (regla de negocio N°10).
//
// ESTADO ACTUAL — qué funciona hoy, sin credenciales ni backend:
//   1. `eventosDeConvenio` / `eventosDeConvenios`: derivan del dominio todas las
//      fechas relevantes (ingreso, límite, entrega a Rectoría, término de etapas).
//   2. `urlGoogleCalendar`: abre el formulario "Crear evento" de Google con los
//      datos ya cargados. No requiere OAuth.
//   3. `generarICS`: exporta un archivo .ics importable en Google Calendar,
//      Outlook o Apple Calendar (Configuración → Importar y exportar).
//
// SIGUIENTE PASO — sincronización automática:
//   `crearSincronizador()` define el contrato que debe implementar el adaptador
//   real contra la Google Calendar API v3. Cuando existan credenciales
//   (VITE_GOOGLE_CLIENT_ID + VITE_GOOGLE_CALENDAR_ID) basta con reemplazar el
//   adaptador `noOp` por uno que use gapi/GIS: la UI ya trabaja contra esta
//   interfaz, así que no hay que tocar las vistas.
//
// El id determinista de cada evento (`uid`) está pensado justamente para eso:
// permite hacer upsert idempotente en Google Calendar sin duplicar eventos.

import { UNIDADES, nombreUnidad } from '../config/convenios';
import { formatFecha, parseFecha, toISO, esFechaValida } from './fechas';

export const TIPOS_EVENTO = {
  INGRESO: { id: 'ingreso', label: 'Ingreso', color: '#3b82f6', icono: '📥' },
  LIMITE: { id: 'limite', label: 'Fecha límite', color: '#ef4444', icono: '⏰' },
  RECTORIA: { id: 'rectoria', label: 'Entrega a Rectoría', color: '#1d4ed8', icono: '🏛️' },
  ETAPA_INICIO: { id: 'etapa-inicio', label: 'Inicio de etapa', color: '#8b5cf6', icono: '▶️' },
  ETAPA_TERMINO: { id: 'etapa-termino', label: 'Término de etapa', color: '#10b981', icono: '✅' },
  SOLICITUD_INGRESO: { id: 'sai-ingreso', label: 'Ingreso solicitud', color: '#0ea5e9', icono: '📨' },
  SOLICITUD_VENCIMIENTO: { id: 'sai-vencimiento', label: 'Vencimiento legal', color: '#ef4444', icono: '⚖️' },
};

const PREFIJO_UID = 'umag-convenios';

function evento({ tipo, fecha, titulo, descripcion, refId, refTipo = 'convenio', clave }) {
  return {
    uid: `${PREFIJO_UID}-${refTipo}-${refId}-${clave}`,
    tipo: tipo.id,
    tipoLabel: tipo.label,
    color: tipo.color,
    icono: tipo.icono,
    fecha,
    titulo,
    descripcion: descripcion || '',
    refId,
    refTipo,
  };
}

// Todas las fechas relevantes de un convenio como eventos de calendario.
export function eventosDeConvenio(convenio) {
  if (!convenio) return [];
  const eventos = [];
  const etiqueta = convenio.codigo ? `[${convenio.codigo}] ${convenio.nombre}` : convenio.nombre;

  if (esFechaValida(convenio.fechaIngreso)) {
    eventos.push(evento({
      tipo: TIPOS_EVENTO.INGRESO, fecha: convenio.fechaIngreso, clave: 'ingreso', refId: convenio.id,
      titulo: `Ingreso: ${etiqueta}`,
      descripcion: `Unidad de origen: ${convenio.unidadOrigen || 'sin especificar'}`,
    }));
  }

  if (esFechaValida(convenio.fechaLimite)) {
    eventos.push(evento({
      tipo: TIPOS_EVENTO.LIMITE, fecha: convenio.fechaLimite, clave: 'limite', refId: convenio.id,
      titulo: `Vence: ${etiqueta}`,
      descripcion: convenio.motivoPrioridad || 'Plazo especial del convenio',
    }));
  }

  if (esFechaValida(convenio.fechaEntregaRectoria)) {
    eventos.push(evento({
      tipo: TIPOS_EVENTO.RECTORIA, fecha: convenio.fechaEntregaRectoria, clave: 'rectoria', refId: convenio.id,
      titulo: `Entrega a Rectoría: ${etiqueta}`,
      descripcion: `Estado: ${convenio.estado}`,
    }));
  }

  (convenio.etapas || []).forEach(etapa => {
    if (etapa.estado === 'No Aplica') return;
    const unidad = nombreUnidad(etapa.unidad);
    if (esFechaValida(etapa.fechaInicio)) {
      eventos.push(evento({
        tipo: TIPOS_EVENTO.ETAPA_INICIO, fecha: etapa.fechaInicio, clave: `etapa-${etapa.unidad}-inicio`, refId: convenio.id,
        titulo: `${unidad} recibe: ${etiqueta}`,
        descripcion: etapa.observaciones || '',
      }));
    }
    if (esFechaValida(etapa.fechaTermino)) {
      eventos.push(evento({
        tipo: TIPOS_EVENTO.ETAPA_TERMINO, fecha: etapa.fechaTermino, clave: `etapa-${etapa.unidad}-termino`, refId: convenio.id,
        titulo: `${unidad} termina: ${etiqueta}`,
        descripcion: `Estado de la etapa: ${etapa.estado}`,
      }));
    }
  });

  return eventos;
}

export function eventosDeConvenios(convenios = []) {
  return convenios.flatMap(eventosDeConvenio).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// Eventos de una solicitud de transparencia (Ley 20.285).
export function eventosDeSolicitud(solicitud) {
  if (!solicitud) return [];
  const eventos = [];
  const etiqueta = solicitud.codigo || solicitud.nombre || 'Solicitud';
  if (esFechaValida(solicitud.fechaIngreso)) {
    eventos.push(evento({
      tipo: TIPOS_EVENTO.SOLICITUD_INGRESO, fecha: solicitud.fechaIngreso, clave: 'ingreso',
      refId: solicitud.id, refTipo: 'solicitud',
      titulo: `Ingreso SAI ${etiqueta}`,
      descripcion: (solicitud.materia || '').slice(0, 200),
    }));
  }
  if (esFechaValida(solicitud.fechaVencimiento)) {
    eventos.push(evento({
      tipo: TIPOS_EVENTO.SOLICITUD_VENCIMIENTO, fecha: solicitud.fechaVencimiento, clave: 'vencimiento',
      refId: solicitud.id, refTipo: 'solicitud',
      titulo: `Vence plazo legal SAI ${etiqueta}`,
      descripcion: 'Art. 14 Ley 20.285: 20 días hábiles (prorrogables por 10).',
    }));
  }
  return eventos;
}

// Agrupa eventos por fecha ISO para pintar el calendario mensual.
export function agruparPorFecha(eventos = []) {
  const mapa = {};
  eventos.forEach(e => {
    if (!mapa[e.fecha]) mapa[e.fecha] = [];
    mapa[e.fecha].push(e);
  });
  return mapa;
}

/* ------------------------ Google Calendar ------------------------- */

// "2026-02-23" → "20260223" (formato de fecha completa de Google/iCalendar)
function aFormatoCalendario(iso) {
  return (iso || '').replace(/-/g, '');
}

function diaSiguiente(iso) {
  const d = parseFecha(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + 1);
  return toISO(d);
}

// URL del formulario "Crear evento" de Google Calendar, precargado.
// Los eventos son de día completo: DTEND es exclusivo, por eso el día siguiente.
export function urlGoogleCalendar(ev) {
  if (!ev || !esFechaValida(ev.fecha)) return '';
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.titulo,
    dates: `${aFormatoCalendario(ev.fecha)}/${aFormatoCalendario(diaSiguiente(ev.fecha))}`,
    details: `${ev.descripcion}\n\n(${ev.tipoLabel} — Sistema de Transparencia y Convenios UMAG)`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Escapa según RFC 5545 (comas, punto y coma, barras y saltos de línea).
function escaparICS(texto) {
  return (texto || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// Genera un archivo .ics con todos los eventos entregados.
export function generarICS(eventos = [], nombreCalendario = 'Convenios UMAG') {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UMAG//Transparencia y Convenios//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escaparICS(nombreCalendario)}`,
  ];
  eventos.filter(e => esFechaValida(e.fecha)).forEach(e => {
    lineas.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}@umag.cl`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${aFormatoCalendario(e.fecha)}`,
      `DTEND;VALUE=DATE:${aFormatoCalendario(diaSiguiente(e.fecha))}`,
      `SUMMARY:${escaparICS(e.titulo)}`,
      `DESCRIPTION:${escaparICS(e.descripcion)}`,
      `CATEGORIES:${escaparICS(e.tipoLabel)}`,
      'END:VEVENT',
    );
  });
  lineas.push('END:VCALENDAR');
  // RFC 5545 exige CRLF como separador de línea.
  return lineas.join('\r\n');
}

// Dispara la descarga del .ics en el navegador.
export function descargarICS(eventos, nombreArchivo = 'convenios-umag.ics') {
  const contenido = generarICS(eventos);
  const blob = new Blob([contenido], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nombreArchivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return contenido;
}

/* --------------- Contrato de sincronización futura ---------------- */

export const CONFIG_GOOGLE = {
  clientId: import.meta.env?.VITE_GOOGLE_CLIENT_ID || '',
  calendarId: import.meta.env?.VITE_GOOGLE_CALENDAR_ID || '',
  scope: 'https://www.googleapis.com/auth/calendar.events',
};

export function googleConfigurado(config = CONFIG_GOOGLE) {
  return Boolean(config.clientId && config.calendarId);
}

// Adaptador por defecto: no sincroniza, pero deja explícito qué falta.
// Sustituirlo por una implementación real de la Google Calendar API v3
// (events.insert / events.update con el `uid` como id determinista).
const adaptadorNoOp = {
  nombre: 'sin-configurar',
  async conectar() {
    return { ok: false, motivo: 'Falta configurar VITE_GOOGLE_CLIENT_ID y VITE_GOOGLE_CALENDAR_ID.' };
  },
  async sincronizar(eventos = []) {
    return { ok: false, enviados: 0, pendientes: eventos.length, motivo: 'Sincronización automática aún no configurada.' };
  },
};

export function crearSincronizador(adaptador = adaptadorNoOp) {
  return {
    disponible: () => googleConfigurado() && adaptador.nombre !== 'sin-configurar',
    conectar: (...args) => adaptador.conectar(...args),
    sincronizar: (...args) => adaptador.sincronizar(...args),
    // Fallback siempre disponible mientras no exista sincronización automática.
    exportar: (eventos, nombre) => descargarICS(eventos, nombre),
  };
}

// Resumen legible del estado de la integración, para mostrar en Configuración.
export function estadoIntegracion() {
  return {
    configurado: googleConfigurado(),
    calendarId: CONFIG_GOOGLE.calendarId,
    exportacionICS: true,
    enlaceDirecto: true,
    sincronizacionAutomatica: false,
    detalle: googleConfigurado()
      ? 'Credenciales presentes. Falta implementar el adaptador de la API para sincronizar automáticamente.'
      : 'Sin credenciales de Google. Disponible: exportación .ics y enlaces "Agregar a Google Calendar".',
  };
}

// Utilidad de presentación reutilizada por varias vistas.
export function describirEvento(ev) {
  return `${ev.icono} ${ev.titulo} — ${formatFecha(ev.fecha)}`;
}

export const UNIDADES_CALENDARIO = UNIDADES;
