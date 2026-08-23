// Utilidades de fecha para convenios y solicitudes de transparencia.
//
// CONVENCIÓN: todas las fechas del dominio se guardan como strings ISO de sólo
// fecha ("YYYY-MM-DD"). Se parsean al mediodía local para evitar que el cambio
// de horario de verano corra un día la fecha mostrada.

import { FERIADOS_CHILE } from '../config/feriados';

const feriados = new Set(FERIADOS_CHILE);

// Permite agregar feriados adicionales (p. ej. feriados regionales o de
// elecciones) sin modificar el archivo de configuración.
export function agregarFeriados(fechas = []) {
  fechas.filter(Boolean).forEach(f => feriados.add(f));
}

export function listarFeriados() {
  return [...feriados].sort();
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

// Convierte "YYYY-MM-DD" en un Date local al mediodía. Devuelve null si no es válida.
export function parseFecha(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const soloFecha = iso.slice(0, 10);
  if (!ISO_RE.test(soloFecha)) return null;
  const [y, m, d] = soloFecha.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  // Rechaza fechas imposibles como 2026-02-31 (JS las desborda al mes siguiente)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

export function esFechaValida(iso) {
  return parseFecha(iso) !== null;
}

// Date → "YYYY-MM-DD" usando componentes locales (no toISOString, que usa UTC).
export function toISO(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function hoyISO() {
  return toISO(new Date());
}

// "2026-02-23" → "23-02-2026"
export function formatFecha(iso) {
  const date = parseFecha(iso);
  if (!date) return '—';
  return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function formatFechaLarga(iso) {
  const date = parseFecha(iso);
  if (!date) return '—';
  return `${date.getDate()} de ${MESES[date.getMonth()]} de ${date.getFullYear()}`;
}

export function nombreMes(indice) {
  return MESES[indice] || '';
}

// Días corridos entre dos fechas (b - a). Positivo si b es posterior.
export function diasEntre(isoA, isoB) {
  const a = parseFecha(isoA);
  const b = parseFecha(isoB);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

// Días corridos que faltan hasta `iso` (negativo si ya pasó).
export function diasHasta(iso, referencia = hoyISO()) {
  return diasEntre(referencia, iso);
}

export function esFinDeSemana(iso) {
  const date = parseFecha(iso);
  if (!date) return false;
  const dia = date.getDay();
  return dia === 0 || dia === 6;
}

export function esFeriado(iso) {
  if (!iso) return false;
  return feriados.has(iso.slice(0, 10));
}

export function esDiaHabil(iso) {
  return esFechaValida(iso) && !esFinDeSemana(iso) && !esFeriado(iso);
}

export function sumarDias(iso, dias) {
  const date = parseFecha(iso);
  if (!date) return '';
  date.setDate(date.getDate() + dias);
  return toISO(date);
}

// Suma `n` días hábiles a partir de `iso` SIN contar el día inicial, que es el
// criterio de la Ley 19.880 ("plazo contado desde la notificación").
// Ejemplo real (acuse de recibo UN016T0000633): 2026-01-26 + 20 hábiles = 2026-02-23.
export function sumarDiasHabiles(iso, n) {
  if (!esFechaValida(iso) || !Number.isFinite(n)) return '';
  let actual = iso.slice(0, 10);
  let restantes = Math.max(0, Math.trunc(n));
  while (restantes > 0) {
    actual = sumarDias(actual, 1);
    if (esDiaHabil(actual)) restantes--;
  }
  return actual;
}

// Días hábiles entre dos fechas, excluyendo el día inicial e incluyendo el final.
// Negativo si `isoB` es anterior a `isoA`.
export function diasHabilesEntre(isoA, isoB) {
  if (!esFechaValida(isoA) || !esFechaValida(isoB)) return null;
  const a = isoA.slice(0, 10);
  const b = isoB.slice(0, 10);
  if (a === b) return 0;
  const invertido = a > b;
  const desde = invertido ? b : a;
  const hasta = invertido ? a : b;
  let cursor = desde;
  let habiles = 0;
  while (cursor < hasta) {
    cursor = sumarDias(cursor, 1);
    if (esDiaHabil(cursor)) habiles++;
  }
  return invertido ? -habiles : habiles;
}

// Días hábiles que faltan hasta `iso` (negativo si el plazo ya venció).
export function diasHabilesHasta(iso, referencia = hoyISO()) {
  return diasHabilesEntre(referencia, iso);
}

// Formatea un rango legible: "12-03-2026 → 20-03-2026"
export function formatRango(isoInicio, isoTermino) {
  if (!isoInicio && !isoTermino) return '—';
  if (!isoTermino) return `${formatFecha(isoInicio)} → en curso`;
  if (!isoInicio) return `→ ${formatFecha(isoTermino)}`;
  return `${formatFecha(isoInicio)} → ${formatFecha(isoTermino)}`;
}

// Duración en días corridos de una etapa cerrada (null si sigue abierta).
export function duracionDias(isoInicio, isoTermino) {
  if (!isoInicio || !isoTermino) return null;
  return diasEntre(isoInicio, isoTermino);
}
