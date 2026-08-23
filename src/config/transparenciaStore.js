// Persistencia de solicitudes de transparencia.
//
// Igual que el módulo de convenios: Supabase cuando está configurado y
// localStorage como respaldo automático.

import { supabase } from './supabase';
import { normalizarSolicitud } from './transparencia';

export const STORAGE_KEY_SOLICITUDES = 'umag_solicitudes_transparencia';

/*
-- SQL para crear la tabla en Supabase (ejecutar en SQL Editor):

CREATE TABLE solicitudes_transparencia (
  id SERIAL PRIMARY KEY,
  codigo TEXT DEFAULT '',
  fecha_ingreso DATE,
  solicitante TEXT DEFAULT '',
  tipo_persona TEXT DEFAULT 'Natural',
  email TEXT DEFAULT '',
  telefono TEXT DEFAULT '',
  via_ingreso TEXT DEFAULT 'Portal de Transparencia',
  materia TEXT DEFAULT '',
  unidad_derivada TEXT DEFAULT '',
  etapa TEXT DEFAULT 'Ingreso y recepción',
  estado TEXT DEFAULT 'Ingresada',
  prorrogada BOOLEAN DEFAULT FALSE,
  fecha_prorroga DATE,
  subsanacion_solicitada BOOLEAN DEFAULT FALSE,
  fecha_subsanacion DATE,
  tercero_involucrado BOOLEAN DEFAULT FALSE,
  fecha_respuesta DATE,
  causal_reserva TEXT DEFAULT '',
  formato_entrega TEXT DEFAULT '',
  medio_envio TEXT DEFAULT '',
  observaciones TEXT DEFAULT '',
  historial JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE solicitudes_transparencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon read solicitudes"   ON solicitudes_transparencia FOR SELECT USING (true);
CREATE POLICY "Anon insert solicitudes" ON solicitudes_transparencia FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon update solicitudes" ON solicitudes_transparencia FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anon delete solicitudes" ON solicitudes_transparencia FOR DELETE USING (true);

-- ⚠ Estas solicitudes contienen datos personales del solicitante (nombre,
-- correo, teléfono). Si se van a almacenar en Supabase, restringir el acceso
-- con Supabase Auth real en vez de la anon key (Opción B de supabase.js).
*/

function formatError(e) {
  if (!e) return 'desconocido';
  return [e.code && `code=${e.code}`, e.message, e.details && `details=${e.details}`]
    .filter(Boolean).join(' | ');
}

export function toRowSolicitud(s) {
  return {
    codigo: s.codigo || '',
    fecha_ingreso: s.fechaIngreso || null,
    solicitante: s.solicitante || '',
    tipo_persona: s.tipoPersona || 'Natural',
    email: s.email || '',
    telefono: s.telefono || '',
    via_ingreso: s.viaIngreso || '',
    materia: s.materia || '',
    unidad_derivada: s.unidadDerivada || '',
    etapa: s.etapa || '',
    estado: s.estado || 'Ingresada',
    prorrogada: Boolean(s.prorrogada),
    fecha_prorroga: s.fechaProrroga || null,
    subsanacion_solicitada: Boolean(s.subsanacionSolicitada),
    fecha_subsanacion: s.fechaSubsanacion || null,
    tercero_involucrado: Boolean(s.terceroInvolucrado),
    fecha_respuesta: s.fechaRespuesta || null,
    causal_reserva: s.causalReserva || '',
    formato_entrega: s.formatoEntrega || '',
    medio_envio: s.medioEnvio || '',
    observaciones: s.observaciones || '',
    historial: s.historial || [],
  };
}

export function fromRowSolicitud(row) {
  if (!row) return null;
  return normalizarSolicitud({
    id: row.id,
    codigo: row.codigo,
    fechaIngreso: row.fecha_ingreso || '',
    solicitante: row.solicitante,
    tipoPersona: row.tipo_persona,
    email: row.email,
    telefono: row.telefono,
    viaIngreso: row.via_ingreso,
    materia: row.materia,
    unidadDerivada: row.unidad_derivada,
    etapa: row.etapa,
    estado: row.estado,
    prorrogada: row.prorrogada,
    fechaProrroga: row.fecha_prorroga || '',
    subsanacionSolicitada: row.subsanacion_solicitada,
    fechaSubsanacion: row.fecha_subsanacion || '',
    terceroInvolucrado: row.tercero_involucrado,
    fechaRespuesta: row.fecha_respuesta || '',
    causalReserva: row.causal_reserva,
    formatoEntrega: row.formato_entrega,
    medioEnvio: row.medio_envio,
    observaciones: row.observaciones,
    historial: row.historial,
  });
}

export function leerSolicitudesLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SOLICITUDES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizarSolicitud).filter(Boolean) : [];
  } catch (e) {
    console.warn('No se pudieron leer las solicitudes locales:', e.message);
    return [];
  }
}

export function guardarSolicitudesLocal(solicitudes) {
  try {
    localStorage.setItem(STORAGE_KEY_SOLICITUDES, JSON.stringify(solicitudes));
    return true;
  } catch (e) {
    console.warn('No se pudieron guardar las solicitudes locales:', e.message);
    return false;
  }
}

export function siguienteIdSolicitud(solicitudes = []) {
  return solicitudes.reduce((max, s) => Math.max(max, Number(s.id) || 0), 0) + 1;
}

export async function fetchSolicitudes() {
  if (!supabase) return { data: null, error: null };
  try {
    const { data, error } = await supabase
      .from('solicitudes_transparencia').select('*').order('fecha_ingreso', { ascending: true });
    if (error) throw error;
    return { data: (data || []).map(fromRowSolicitud).filter(Boolean), error: null };
  } catch (e) {
    console.error('[solicitudes:fetchAll]', formatError(e));
    return { data: null, error: formatError(e) };
  }
}

export async function insertSolicitud(solicitud) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('solicitudes_transparencia').insert(toRowSolicitud(solicitud)).select().single();
    if (error) throw error;
    return fromRowSolicitud(data);
  } catch (e) {
    console.error('[solicitudes:insert]', formatError(e));
    return null;
  }
}

export async function upsertSolicitud(solicitud) {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('solicitudes_transparencia').upsert({ id: solicitud.id, ...toRowSolicitud(solicitud) });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('[solicitudes:upsert]', formatError(e));
    return false;
  }
}

export async function deleteSolicitud(id) {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('solicitudes_transparencia').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('[solicitudes:delete]', formatError(e));
    return false;
  }
}
