// Supabase Configuration
export const SUPABASE_URL = 'https://pzqzupcjalggdlibplcw.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6cXp1cGNqYWxnZ2RsaWJwbGN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNTI4MzAsImV4cCI6MjA5MDgyODgzMH0.3mP_NgsS5awP4k4_5J2x4YQwc-OaoMLsSFMFKBV2WJw';

// Inicializar cliente Supabase (solo si está configurado y la librería cargó)
let supabase = null;
try {
  if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase && window.supabase.createClient) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) {
  console.warn('Supabase no disponible, usando localStorage:', e.message);
}

export { supabase };

/*
-- SQL para crear la tabla en Supabase (ejecutar en SQL Editor):

CREATE TABLE regulations (
  id SERIAL PRIMARY KEY,
  numero TEXT NOT NULL,
  nombre TEXT NOT NULL,
  articulo TEXT DEFAULT '',
  estado TEXT DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'En Proceso', 'En Revisión', 'Aprobado')),
  progreso INTEGER DEFAULT 0 CHECK (progreso >= 0 AND progreso <= 100),
  prioridad TEXT DEFAULT 'media' CHECK (prioridad IN ('alta', 'media', 'baja')),
  responsable TEXT DEFAULT '',
  observaciones TEXT DEFAULT '',
  enlace TEXT DEFAULT '',
  decreto TEXT DEFAULT '',
  articulo_estatuto TEXT DEFAULT '',
  historial JSONB DEFAULT '[]',
  adjuntos JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Si ya tienes la tabla creada, puedes agregar las columnas faltantes así:
-- ALTER TABLE regulations ADD COLUMN IF NOT EXISTS observaciones TEXT DEFAULT '';
-- ALTER TABLE regulations ADD COLUMN IF NOT EXISTS enlace TEXT DEFAULT '';
-- ALTER TABLE regulations ADD COLUMN IF NOT EXISTS decreto TEXT DEFAULT '';
-- ALTER TABLE regulations ADD COLUMN IF NOT EXISTS articulo_estatuto TEXT DEFAULT '';

-- Habilitar RLS (Row Level Security)
ALTER TABLE regulations ENABLE ROW LEVEL SECURITY;

-- Política para permitir acceso público (ajustar según necesidad)
CREATE POLICY "Allow all access" ON regulations FOR ALL USING (true) WITH CHECK (true);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_timestamp
  BEFORE UPDATE ON regulations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
*/

// Helper functions para Supabase
export async function supabaseFetchAll() {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from('regulations').select('*').order('id');
    if (error) throw error;
    return data;
  } catch (e) {
    console.error('Supabase fetch error:', e);
    return null;
  }
}

export async function supabaseUpsert(regulation) {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('regulations').upsert({
      id: regulation.id,
      numero: regulation.numero,
      nombre: regulation.nombre,
      articulo: regulation.articulo || '',
      estado: regulation.estado,
      progreso: regulation.progreso,
      prioridad: regulation.prioridad,
      responsable: regulation.responsable || '',
      observaciones: regulation.observaciones || '',
      enlace: regulation.enlace || '',
      decreto: regulation.decreto || '',
      articulo_estatuto: regulation.articulo_estatuto || '',
      historial: regulation.historial || [],
      adjuntos: regulation.adjuntos || []
    });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Supabase upsert error:', e);
    return false;
  }
}

export async function supabaseDelete(id) {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('regulations').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Supabase delete error:', e);
    return false;
  }
}

export async function supabaseInsert(regulation) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from('regulations').insert({
      numero: regulation.numero,
      nombre: regulation.nombre,
      articulo: regulation.articulo || '',
      estado: regulation.estado,
      progreso: regulation.progreso,
      prioridad: regulation.prioridad,
      responsable: regulation.responsable || '',
      observaciones: regulation.observaciones || '',
      enlace: regulation.enlace || '',
      decreto: regulation.decreto || '',
      articulo_estatuto: regulation.articulo_estatuto || '',
      historial: regulation.historial || [],
      adjuntos: regulation.adjuntos || []
    }).select().single();
    if (error) throw error;
    return data;
  } catch (e) {
    console.error('Supabase insert error:', e);
    return null;
  }
}

export async function supabaseSeedIfEmpty() {
  if (!supabase) return;
  try {
    const { count, error: countError } = await supabase.from('regulations').select('*', { count: 'exact', head: true });
    if (countError) { console.warn('Supabase count error:', countError.message); return; }
    if (count === 0) {
      const { error } = await supabase.from('regulations').insert(INITIAL_REGULATIONS.map(r => ({
        numero: r.numero, nombre: r.nombre, articulo: r.articulo,
        estado: r.estado, progreso: r.progreso, prioridad: r.prioridad,
        responsable: r.responsable, observaciones: r.observaciones || '',
        enlace: r.enlace || '', decreto: r.decreto || '',
        articulo_estatuto: r.articulo_estatuto || '',
        historial: r.historial, adjuntos: r.adjuntos
      })));
      if (error) console.warn('Seed error:', error.message);
    }
  } catch (e) {
    console.warn('Seed check error:', e.message);
  }
}
