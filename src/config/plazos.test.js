import { describe, it, expect } from 'vitest';
import { FECHAS_LIMITE } from './plazos';

describe('FECHAS_LIMITE', () => {
  it('contiene fecha de reglamentos', () => {
    expect(FECHAS_LIMITE.REGLAMENTOS).toBeDefined();
    expect(new Date(FECHAS_LIMITE.REGLAMENTOS).toString()).not.toBe('Invalid Date');
  });

  it('contiene fecha de unidades', () => {
    expect(FECHAS_LIMITE.UNIDADES).toBeDefined();
    expect(new Date(FECHAS_LIMITE.UNIDADES).toString()).not.toBe('Invalid Date');
  });
});
