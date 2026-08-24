// Generación de CSV para Excel.
//
// Además de escapar comillas y separadores, este módulo neutraliza la
// INYECCIÓN DE FÓRMULAS, que es el riesgo real de exportar texto que escribió
// otra persona.
//
// Entrecomillar el campo resuelve el separador, pero NO impide que Excel
// interprete el contenido de la celda: al abrir el archivo, una celda cuyo
// texto empieza por = + - @ se evalúa como fórmula. Un convenio llamado
//   =HYPERLINK("http://sitio-de-un-tercero","Ver informe")
// se convierte en un enlace vivo en cuanto alguien abre el reporte, y con
// otras funciones se puede llegar a filtrar el contenido de la planilla.
//
// La defensa habitual (y la que recomienda OWASP) es anteponer un apóstrofo,
// que marca la celda como texto. El valor exportado queda con ese apóstrofo
// delante; es un precio bajo y sólo lo pagan los campos que empiezan por uno
// de esos caracteres, que en convenios y solicitudes no ocurre naturalmente.

// Caracteres con los que una celda deja de ser texto para Excel y Google Sheets.
// El tabulador y el retorno de carro entran porque Excel los ignora al principio
// y evalúa lo que viene después.
const INICIO_DE_FORMULA = /^[=+\-@\t\r]/;

export function neutralizarFormula(texto) {
  return INICIO_DE_FORMULA.test(texto) ? `'${texto}` : texto;
}

// Un valor cualquiera como campo CSV: neutralizado, entrecomillado y con las
// comillas internas duplicadas (RFC 4180).
export function campoCSV(valor) {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  return `"${neutralizarFormula(texto).replace(/"/g, '""')}"`;
}

export function filaCSV(campos = [], separador = ';') {
  return campos.map(campoCSV).join(separador);
}

/**
 * Arma el CSV completo.
 *
 * Por defecto usa punto y coma y BOM UTF-8, que es lo que espera Excel en
 * español: con coma parte las columnas mal y sin BOM se come los acentos.
 */
export function generarCSV(encabezados, filas, { separador = ';', bom = true } = {}) {
  const lineas = [encabezados, ...filas].map(f => filaCSV(f, separador));
  return (bom ? '﻿' : '') + lineas.join('\r\n');
}
