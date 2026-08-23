import { describe, it, expect } from 'vitest';
import {
  parseFecha, esFechaValida, toISO, formatFecha, diasEntre, diasHasta,
  esFinDeSemana, esFeriado, esDiaHabil, sumarDias, sumarDiasHabiles,
  diasHabilesEntre, diasHabilesHasta, duracionDias, agregarFeriados, listarFeriados,
} from './fechas';

describe('parseFecha / esFechaValida', () => {
  it('parsea una fecha ISO al mediodía local', () => {
    const d = parseFecha('2026-02-23');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(23);
  });

  it('rechaza fechas imposibles y basura', () => {
    expect(parseFecha('2026-02-31')).toBeNull();
    expect(parseFecha('23-02-2026')).toBeNull();
    expect(parseFecha('')).toBeNull();
    expect(parseFecha(null)).toBeNull();
    expect(esFechaValida('2026-13-01')).toBe(false);
  });

  it('acepta timestamps completos usando sólo la parte de fecha', () => {
    expect(esFechaValida('2026-02-23T10:30:00Z')).toBe(true);
  });
});

describe('toISO / formatFecha', () => {
  it('convierte un Date local a ISO sin desfase de zona horaria', () => {
    expect(toISO(new Date(2026, 0, 1, 23, 30))).toBe('2026-01-01');
  });

  it('formatea al estilo chileno dd-mm-aaaa', () => {
    expect(formatFecha('2026-02-23')).toBe('23-02-2026');
    expect(formatFecha('')).toBe('—');
  });
});

describe('diferencias de días corridos', () => {
  it('cuenta días entre fechas', () => {
    expect(diasEntre('2026-01-01', '2026-01-31')).toBe(30);
    expect(diasEntre('2026-01-31', '2026-01-01')).toBe(-30);
  });

  it('cuenta días hasta una fecha respecto de una referencia', () => {
    expect(diasHasta('2026-03-10', '2026-03-01')).toBe(9);
    expect(diasHasta('2026-03-01', '2026-03-10')).toBe(-9);
  });

  it('atraviesa el cambio de horario de verano sin perder un día', () => {
    // En Chile el horario de verano cambia en septiembre y abril.
    expect(diasEntre('2026-04-04', '2026-04-05')).toBe(1);
    expect(diasEntre('2026-09-05', '2026-09-06')).toBe(1);
  });

  it('calcula la duración de una etapa cerrada', () => {
    expect(duracionDias('2026-03-02', '2026-03-12')).toBe(10);
    expect(duracionDias('2026-03-02', '')).toBeNull();
  });
});

describe('días hábiles', () => {
  it('reconoce fines de semana', () => {
    expect(esFinDeSemana('2026-02-21')).toBe(true);  // sábado
    expect(esFinDeSemana('2026-02-22')).toBe(true);  // domingo
    expect(esFinDeSemana('2026-02-23')).toBe(false); // lunes
  });

  it('reconoce feriados de la tabla', () => {
    expect(esFeriado('2026-09-18')).toBe(true);
    expect(esDiaHabil('2026-09-18')).toBe(false);
    expect(esDiaHabil('2026-02-23')).toBe(true);
  });

  it('reproduce el plazo del acuse de recibo del Portal de Transparencia', () => {
    // Solicitud UN016T0000633: ingresó el 26/01/2026, vence el 23/02/2026.
    expect(sumarDiasHabiles('2026-01-26', 20)).toBe('2026-02-23');
  });

  it('salta fines de semana y feriados al sumar', () => {
    // Viernes + 1 hábil = lunes
    expect(sumarDiasHabiles('2026-02-20', 1)).toBe('2026-02-23');
    // 17-09-2026 (jueves) + 1 hábil salta el 18 y 19 de septiembre
    expect(sumarDiasHabiles('2026-09-17', 1)).toBe('2026-09-21');
  });

  it('sumar 0 días hábiles deja la fecha igual', () => {
    expect(sumarDiasHabiles('2026-02-23', 0)).toBe('2026-02-23');
  });

  it('cuenta días hábiles entre dos fechas de forma simétrica', () => {
    expect(diasHabilesEntre('2026-01-26', '2026-02-23')).toBe(20);
    expect(diasHabilesEntre('2026-02-23', '2026-01-26')).toBe(-20);
    expect(diasHabilesEntre('2026-02-23', '2026-02-23')).toBe(0);
  });

  it('diasHabilesHasta es negativo cuando el plazo ya venció', () => {
    expect(diasHabilesHasta('2026-02-20', '2026-02-23')).toBeLessThan(0);
  });

  it('sumarDias avanza en días corridos', () => {
    expect(sumarDias('2026-02-28', 1)).toBe('2026-03-01');
  });
});

describe('agregarFeriados', () => {
  it('permite registrar feriados adicionales en caliente', () => {
    agregarFeriados(['2030-06-17']);
    expect(esFeriado('2030-06-17')).toBe(true);
    expect(listarFeriados()).toContain('2030-06-17');
  });
});
