import { describe, it, expect } from 'vitest';
import {
  MODO, calcularModo, usaPlanilla, permiteEscribir, etiquetaModo, mensajeSinConexion,
} from './modoDatos';

describe('calcularModo', () => {
  it('sin planilla configurada trabaja en local, responda o no la red', () => {
    expect(calcularModo(false, false)).toBe(MODO.LOCAL);
    expect(calcularModo(false, true)).toBe(MODO.LOCAL);
  });

  it('con planilla configurada y respondiendo usa la planilla', () => {
    expect(calcularModo(true, false)).toBe(MODO.SHEETS);
  });

  it('con planilla configurada que no responde queda sin conexión, NO en local', () => {
    // Esta es la distinción que faltaba: antes un fallo de red dejaba la app
    // en modo local y los registros nuevos se perdían en la siguiente carga.
    expect(calcularModo(true, true)).toBe(MODO.SIN_CONEXION);
    expect(calcularModo(true, true)).not.toBe(MODO.LOCAL);
  });

  it('vuelve a la planilla en cuanto la conexión se recupera', () => {
    let caida = true;
    expect(calcularModo(true, caida)).toBe(MODO.SIN_CONEXION);
    caida = false;
    expect(calcularModo(true, caida)).toBe(MODO.SHEETS);
  });
});

describe('usaPlanilla', () => {
  it('sólo escribe en la planilla cuando la planilla responde', () => {
    expect(usaPlanilla(MODO.SHEETS)).toBe(true);
    expect(usaPlanilla(MODO.SIN_CONEXION)).toBe(false);
    expect(usaPlanilla(MODO.LOCAL)).toBe(false);
  });
});

describe('permiteEscribir', () => {
  it('deja escribir con planilla o sin ella configurada', () => {
    expect(permiteEscribir(MODO.SHEETS)).toBe(true);
    expect(permiteEscribir(MODO.LOCAL)).toBe(true);
  });

  it('no deja escribir mientras la planilla no responde', () => {
    expect(permiteEscribir(MODO.SIN_CONEXION)).toBe(false);
  });
});

describe('textos', () => {
  it('cada modo se describe distinto', () => {
    const etiquetas = [MODO.SHEETS, MODO.SIN_CONEXION, MODO.LOCAL].map(etiquetaModo);
    expect(new Set(etiquetas).size).toBe(3);
    expect(etiquetaModo(MODO.SIN_CONEXION)).toMatch(/sin conexión/i);
  });

  it('el mensaje de bloqueo nombra la acción que se intentó', () => {
    expect(mensajeSinConexion('crear el convenio')).toContain('crear el convenio');
  });
});
