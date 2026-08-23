import { describe, it, expect } from 'vitest';
import { toRow, fromRow, siguienteIdLocal, leerLocal, guardarLocal, STORAGE_KEY } from './conveniosStore';
import { crearConvenio, normalizarConvenio, crearEtapas } from './convenios';

const CONVENIO = normalizarConvenio(crearConvenio({
  id: 4,
  codigo: 'CONV-2026-004',
  nombre: 'Convenio de práctica profesional',
  unidadOrigen: 'Facultad de Ingeniería',
  contraparte: 'Municipalidad de Punta Arenas',
  tipo: 'Práctica profesional',
  fechaIngreso: '2026-02-10',
  fechaEntregaRectoria: '2026-03-20',
  estado: 'En Tramitación',
  prioridad: 'alta',
  motivoPrioridad: 'Inicio del semestre',
  plazoEspecial: true,
  fechaLimite: '2026-03-25',
  observaciones: 'Pendiente firma',
  etapas: crearEtapas(['VRAF', 'VRAC']),
}));

describe('mapeo entre la app y la tabla de Supabase', () => {
  it('convierte a snake_case sin perder campos', () => {
    const row = toRow(CONVENIO);
    expect(row.unidad_origen).toBe('Facultad de Ingeniería');
    expect(row.fecha_entrega_rectoria).toBe('2026-03-20');
    expect(row.plazo_especial).toBe(true);
    expect(row.etapas).toHaveLength(2);
  });

  it('convierte las fechas vacías a null, que es lo que espera una columna DATE', () => {
    const row = toRow(crearConvenio({ nombre: 'Sin fechas' }));
    expect(row.fecha_ingreso).toBeNull();
    expect(row.fecha_limite).toBeNull();
    expect(row.fecha_entrega_rectoria).toBeNull();
  });

  it('el viaje de ida y vuelta conserva los datos', () => {
    const vuelta = fromRow({ id: CONVENIO.id, ...toRow(CONVENIO) });
    expect(vuelta.nombre).toBe(CONVENIO.nombre);
    expect(vuelta.unidadOrigen).toBe(CONVENIO.unidadOrigen);
    expect(vuelta.fechaLimite).toBe(CONVENIO.fechaLimite);
    expect(vuelta.etapas.map(e => e.unidad)).toEqual(['VRAF', 'VRAC']);
  });

  it('las fechas null vuelven como cadena vacía, no como "null"', () => {
    const vuelta = fromRow({ id: 1, nombre: 'X', fecha_ingreso: null, fecha_limite: null });
    expect(vuelta.fechaIngreso).toBe('');
    expect(vuelta.fechaLimite).toBe('');
  });

  it('fromRow devuelve null si no hay fila', () => {
    expect(fromRow(null)).toBeNull();
  });
});

describe('normalización defensiva', () => {
  it('rellena etapas e historial ausentes', () => {
    const c = normalizarConvenio({ id: 1, nombre: 'Mínimo' });
    expect(c.etapas.length).toBeGreaterThan(0);
    expect(c.historial).toEqual([]);
    expect(c.adjuntos).toEqual([]);
  });

  it('ordena las etapas por su campo orden', () => {
    const c = normalizarConvenio({
      id: 1, nombre: 'Desordenado',
      etapas: [{ unidad: 'VRAC', orden: 1 }, { unidad: 'VRAF', orden: 0 }],
    });
    expect(c.etapas.map(e => e.unidad)).toEqual(['VRAF', 'VRAC']);
  });

  it('descarta valores que no son objetos', () => {
    expect(normalizarConvenio(null)).toBeNull();
    expect(normalizarConvenio('texto')).toBeNull();
  });
});

describe('almacenamiento local', () => {
  it('genera IDs locales sin colisionar', () => {
    expect(siguienteIdLocal([])).toBe(1);
    expect(siguienteIdLocal([{ id: 3 }, { id: 7 }, { id: 5 }])).toBe(8);
  });

  it('guarda y relee la lista completa', () => {
    localStorage.removeItem(STORAGE_KEY);
    expect(leerLocal()).toEqual([]);
    guardarLocal([CONVENIO]);
    const leidos = leerLocal();
    expect(leidos).toHaveLength(1);
    expect(leidos[0].nombre).toBe(CONVENIO.nombre);
  });

  it('tolera contenido corrupto en localStorage', () => {
    localStorage.setItem(STORAGE_KEY, '{no es json');
    expect(leerLocal()).toEqual([]);
    localStorage.setItem(STORAGE_KEY, '{"no":"un arreglo"}');
    expect(leerLocal()).toEqual([]);
    localStorage.removeItem(STORAGE_KEY);
  });
});
