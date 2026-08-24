// Respaldo local de solicitudes de transparencia en el navegador.
//
// Igual que los convenios: el almacén remoto es Google Sheets y esto es la
// copia local que mantiene la app utilizable sin conexión a la planilla.
//
// ⚠ Estas solicitudes contienen datos personales del solicitante (nombre,
// correo, teléfono). Al vivir en localStorage quedan en el navegador de quien
// use la app; conviene no usarla en equipos compartidos.

import { normalizarSolicitud } from './transparencia';

export const STORAGE_KEY_SOLICITUDES = 'umag_solicitudes_transparencia';

export function leerSolicitudesLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SOLICITUDES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizarSolicitud).filter(Boolean) : [];
  } catch (e) {
    console.warn('No se pudieron leer las solicitudes locales:', e.message);
    return [];
  }
}

export function guardarSolicitudesLocal(solicitudes) {
  try {
    localStorage.setItem(STORAGE_KEY_SOLICITUDES, JSON.stringify(solicitudes));
    return true;
  } catch (e) {
    console.warn('No se pudieron guardar las solicitudes locales:', e.message);
    return false;
  }
}

export function siguienteIdSolicitud(solicitudes = []) {
  return solicitudes.reduce((max, s) => Math.max(max, Number(s.id) || 0), 0) + 1;
}
