import { describe, it, expect } from 'vitest';
import { INITIAL_REGULATIONS } from './data';

describe('INITIAL_REGULATIONS', () => {
  it('es un array con al menos 30 reglamentos', () => {
    expect(Array.isArray(INITIAL_REGULATIONS)).toBe(true);
    expect(INITIAL_REGULATIONS.length).toBeGreaterThanOrEqual(30);
  });

  it('cada reglamento tiene campos requeridos', () => {
    INITIAL_REGULATIONS.forEach(reg => {
      expect(reg).toHaveProperty('id');
      expect(reg).toHaveProperty('nombre');
      expect(reg).toHaveProperty('estado');
      expect(reg).toHaveProperty('progreso');
      expect(reg).toHaveProperty('prioridad');
    });
  });

  it('estados son valores válidos', () => {
    const estadosValidos = ['Pendiente', 'En Proceso', 'En Revisión', 'Aprobado'];
    INITIAL_REGULATIONS.forEach(reg => {
      expect(estadosValidos).toContain(reg.estado);
    });
  });

  it('progreso está entre 0 y 100', () => {
    INITIAL_REGULATIONS.forEach(reg => {
      expect(reg.progreso).toBeGreaterThanOrEqual(0);
      expect(reg.progreso).toBeLessThanOrEqual(100);
    });
  });

  it('prioridades son valores válidos', () => {
    const prioridadesValidas = ['alta', 'media', 'baja'];
    INITIAL_REGULATIONS.forEach(reg => {
      expect(prioridadesValidas).toContain(reg.prioridad);
    });
  });

  it('IDs son únicos', () => {
    const ids = INITIAL_REGULATIONS.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reglamentos Aprobados tienen progreso 100', () => {
    INITIAL_REGULATIONS.filter(r => r.estado === 'Aprobado').forEach(reg => {
      expect(reg.progreso).toBe(100);
    });
  });
});
