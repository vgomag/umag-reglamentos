// Respaldo local de convenios en el navegador.
//
// El almacén remoto es Google Sheets (src/config/sheetsStore.js). Este módulo
// guarda además una copia en localStorage, que sirve de dos maneras: la app
// muestra datos al instante mientras la planilla responde, y sigue siendo
// usable si la planilla no está configurada o no contesta.

import { normalizarConvenio } from './convenios';

export const STORAGE_KEY = 'umag_convenios';

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

// ID local seguro: máximo actual + 1. Sólo se usa cuando no hay planilla
// configurada; con Sheets el id lo asigna el Apps Script.
export function siguienteIdLocal(convenios = []) {
  return convenios.reduce((max, c) => Math.max(max, Number(c.id) || 0), 0) + 1;
}
