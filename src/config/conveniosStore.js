// Persistencia de convenios: Supabase si está configurado, localStorage si no.
//
// Reutiliza el mismo cliente y el mismo patrón de manejo de errores que
// src/config/supabase.js (módulo de Reglamentos) para no abrir una segunda
// forma de hablar con la base de datos.

import { supabase } from './supabase';
import { normalizarConvenio } from './convenios';

export const STORAGE_KEY = 'umag_convenios';

/*
-- SQL para crear la tabla en Supabase (ejecutar en SQL Editor):

CREATE TABLE convenios (
  id SERIAL PRIMARY KEY,
  codigo TEXT DEFAULT '',
  nombre TEXT NOT NULL,
  unidad_origen TEXT DEFAULT '',
  contraparte TEXT DEFAULT '',
  tipo TEXT DEFAULT '',
  fecha_ingreso DATE,
  fecha_entrega_rectoria DATE,
  estado TEXT DEFAULT 'Ingresado',
  prioridad TEXT DEFAULT 'normal' CHECK (prioridad IN ('normal','alta','urgente')),
  motivo_prioridad TEXT DEFAULT '',
  plazo_especial BOOLEAN DEFAULT FALSE,
  fecha_limite DATE,
  observaciones TEXT DEFAULT '',
  etapas JSONB DEFAULT '[]',
  historial JSONB DEFAULT '[]',
  adjuntos JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE convenios ENABLE ROW LEVEL SECURITY;

-- Mismas consideraciones que la tabla `regulations`: la app usa la anon key,
-- así que las policies deben permitir el rol 'anon' o todo caerá a localStorage.
CREATE POLICY "Anon read convenios"   ON convenios FOR SELECT USING (true);
CREATE POLICY "Anon insert convenios" ON convenios FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon update convenios" ON convenios FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anon delete convenios" ON convenios FOR DELETE USING (true);

CREATE TRIGGER trigger_convenios_timestamp
  BEFORE UPDATE ON convenios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
*/

function formatError(e) {
  if (!e) return 'desconocido';
  const parts = [];
  if (e.code) parts.push(`code=${e.code}`);
  if (e.message) parts.push(e.message);
  if (e.details) parts.push(`details=${e.details}`);
  if (e.hint) parts.push(`hint=${e.hint}`);
  return parts.join(' | ');
}

let ultimoError = null;
export function getUltimoErrorConvenios() { return ultimoError; }
function setError(op, e) {
  ultimoError = { op, error: formatError(e), at: new Date().toISOString() };
  console.error(`[convenios:${op}]`, ultimoError.error);
}

// App (camelCase) → tabla (snake_case)
export function toRow(c) {
  return {
    codigo: c.codigo || '',
    nombre: c.nombre,
    unidad_origen: c.unidadOrigen || '',
    contraparte: c.contraparte || '',
    tipo: c.tipo || '',
    fecha_ingreso: c.fechaIngreso || null,
    fecha_entrega_rectoria: c.fechaEntregaRectoria || null,
    estado: c.estado || 'Ingresado',
    prioridad: c.prioridad || 'normal',
    motivo_prioridad: c.motivoPrioridad || '',
    plazo_especial: Boolean(c.plazoEspecial),
    fecha_limite: c.fechaLimite || null,
    observaciones: c.observaciones || '',
    etapas: c.etapas || [],
    historial: c.historial || [],
    adjuntos: c.adjuntos || [],
  };
}

// Tabla (snake_case) → app (camelCase)
export function fromRow(row) {
  if (!row) return null;
  return normalizarConvenio({
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    unidadOrigen: row.unidad_origen,
    contraparte: row.contraparte,
    tipo: row.tipo,
    fechaIngreso: row.fecha_ingreso || '',
    fechaEntregaRectoria: row.fecha_entrega_rectoria || '',
    estado: row.estado,
    prioridad: row.prioridad,
    motivoPrioridad: row.motivo_prioridad,
    plazoEspecial: row.plazo_especial,
    fechaLimite: row.fecha_limite || '',
    observaciones: row.observaciones,
    etapas: row.etapas,
    historial: row.historial,
    adjuntos: row.adjuntos,
  });
}

/* ---------------------- almacenamiento local ---------------------- */

export function leerLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizarConvenio).filter(Boolean) : [];
  } catch (e) {
    console.warn('No se pudieron leer los convenios locales:', e.message);
    return [];
  }
}

export function guardarLocal(convenios) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convenios));
    return true;
  } catch (e) {
    console.warn('No se pudieron guardar los convenios locales:', e.message);
    return false;
  }
}

// ID local seguro: máximo actual + 1 (mismo criterio que el módulo de reglamentos).
export function siguienteIdLocal(convenios = []) {
  return convenios.reduce((max, c) => Math.max(max, Number(c.id) || 0), 0) + 1;
}

/* ------------------------- Supabase ------------------------------- */

export const soportaSupabase = () => Boolean(supabase);

export async function fetchConvenios() {
  if (!supabase) return { data: null, error: null };
  try {
    const { data, error } = await supabase.from('convenios').select('*').order('fecha_ingreso', { ascending: true });
    if (error) throw error;
    return { data: (data || []).map(fromRow).filter(Boolean), error: null };
  } catch (e) {
    setError('fetchAll', e);
    return { data: null, error: formatError(e) };
  }
}

export async function insertConvenio(convenio) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from('convenios').insert(toRow(convenio)).select().single();
    if (error) throw error;
    return fromRow(data);
  } catch (e) {
    setError('insert', e);
    return null;
  }
}

export async function upsertConvenio(convenio) {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('convenios').upsert({ id: convenio.id, ...toRow(convenio) });
    if (error) throw error;
    return true;
  } catch (e) {
    setError('upsert', e);
    return false;
  }
}

export async function deleteConvenio(id) {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('convenios').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    setError('delete', e);
    return false;
  }
}
