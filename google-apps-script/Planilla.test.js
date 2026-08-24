import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Pruebas de ciclo completo contra el Apps Script real.
 *
 * Codigo.test.js prueba la conversión fila ↔ objeto de forma aislada. Acá se
 * monta una planilla en memoria y se ejercita el script de punta a punta
 * (crear → listar → eliminar → volver a crear), que es donde vivían los
 * problemas de ids reutilizados e historial huérfano.
 */
const codigo = fs.readFileSync(
  path.resolve(process.cwd(), 'google-apps-script/Codigo.gs'), 'utf-8');

// ── Planilla en memoria ────────────────────────────────────────────
// Sólo implementa lo que el script usa. filas[0] es el encabezado.
function hojaFalsa(nombre) {
  const filas = [];
  return {
    nombre,
    filas,
    getLastRow: () => filas.length,
    getLastColumn: () => (filas[0] ? filas[0].length : 0),
    setFrozenRows: () => {},
    appendRow: (f) => { filas.push(f.slice()); },
    deleteRow: (n) => { filas.splice(n - 1, 1); },
    getRange: (r, c, nFilas, nCols) => ({
      getValues: () => Array.from({ length: nFilas }, (_, i) => {
        const fila = filas[r - 1 + i] || [];
        return Array.from({ length: nCols }, (_, j) => (fila[c - 1 + j] ?? ''));
      }),
      setValues: (valores) => {
        valores.forEach((v, i) => {
          while (filas.length < r - 1 + i) filas.push([]);
          filas[r - 1 + i] = v.slice();
        });
      },
      setFontWeight: () => {},
    }),
  };
}

function cargarScript() {
  const hojas = {};
  const propiedades = {};
  const servicios = {
    Utilities: {
      formatDate: (f) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`,
    },
    Session: { getScriptTimeZone: () => 'America/Santiago' },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (n) => hojas[n] || null,
        insertSheet: (n) => { hojas[n] = hojaFalsa(n); return hojas[n]; },
      }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k in propiedades ? propiedades[k] : null),
        setProperty: (k, v) => { propiedades[k] = String(v); },
      }),
    },
    ContentService: { createTextOutput: () => ({ setMimeType: () => ({}) }), MimeType: { JSON: 'json' } },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  };

  const exportar = `; return {
    crearConvenio, actualizarConvenio, eliminarConvenio,
    crearSolicitud, eliminarSolicitud,
    listarTodo, leerHoja, siguienteId, HOJA_HISTORIAL, HOJA_CONVENIOS,
  };`;
  // eslint-disable-next-line no-new-func
  const api = new Function(...Object.keys(servicios), codigo + exportar)(...Object.values(servicios));
  return { ...api, hojas, propiedades };
}

const evento = (id, descripcion, usuario = 'ana@umag.cl') => ({
  id, fecha: '2026-01-15T10:00:00.000Z', tipo: 'creacion', descripcion, usuario,
});

const convenio = (nombre, historial = []) => ({ nombre, etapas: [], historial });

let gs;
beforeEach(() => { gs = cargarScript(); });

describe('ids de la planilla', () => {
  it('no reutiliza el id de un registro borrado', () => {
    gs.crearConvenio(convenio('Convenio A'));   // id 1
    gs.crearConvenio(convenio('Convenio B'));   // id 2
    gs.eliminarConvenio(2);

    const nuevo = gs.crearConvenio(convenio('Convenio C'));
    expect(nuevo.id).toBe(3);
  });

  it('no reutiliza el id ni siquiera vaciando la planilla entera', () => {
    gs.crearConvenio(convenio('Convenio A'));
    gs.crearConvenio(convenio('Convenio B'));
    gs.eliminarConvenio(1);
    gs.eliminarConvenio(2);
    expect(gs.listarTodo().convenios).toHaveLength(0);

    expect(gs.crearConvenio(convenio('Convenio C')).id).toBe(3);
  });

  it('lleva contadores separados por hoja', () => {
    gs.crearConvenio(convenio('Convenio A'));
    gs.crearConvenio(convenio('Convenio B'));
    expect(gs.crearSolicitud({ materia: 'Primera solicitud', historial: [] }).id).toBe(1);
  });

  it('respeta las filas de una planilla anterior a este cambio', () => {
    // Planilla ya poblada, sin contador guardado: el id sigue desde el máximo.
    gs.crearConvenio(convenio('Convenio A'));
    gs.crearConvenio(convenio('Convenio B'));
    delete gs.propiedades.ultimo_id_Convenios;

    expect(gs.crearConvenio(convenio('Convenio C')).id).toBe(3);
  });

  it('no retrocede si alguien borra filas a mano en la planilla', () => {
    gs.crearConvenio(convenio('Convenio A'));
    gs.crearConvenio(convenio('Convenio B'));
    gs.hojas.Convenios.filas.splice(1); // se borran las dos filas a mano

    expect(gs.crearConvenio(convenio('Convenio C')).id).toBe(3);
  });
});

describe('borrado del historial', () => {
  const filasHistorial = () => gs.leerHoja(gs.HOJA_HISTORIAL).filas;

  it('se lleva las filas de historial del convenio borrado', () => {
    gs.crearConvenio(convenio('Convenio A', [evento('ev-1', 'Convenio A ingresado')]));
    expect(filasHistorial()).toHaveLength(1);

    gs.eliminarConvenio(1);
    expect(filasHistorial()).toHaveLength(0);
  });

  it('un convenio nuevo no hereda el historial de uno borrado', () => {
    gs.crearConvenio(convenio('Convenio A', [evento('ev-1', 'RESERVADO: antecedentes del convenio A')]));
    gs.eliminarConvenio(1);

    gs.crearConvenio(convenio('Convenio B', [evento('ev-2', 'Convenio B ingresado')]));
    const [creado] = gs.listarTodo().convenios;

    expect(creado.nombre).toBe('Convenio B');
    expect(creado.historial.map(h => h.descripcion)).toEqual(['Convenio B ingresado']);
  });

  it('conserva el historial de los demás convenios', () => {
    gs.crearConvenio(convenio('Convenio A', [evento('ev-a', 'Ingresa A')]));
    gs.crearConvenio(convenio('Convenio B', [evento('ev-b', 'Ingresa B')]));
    gs.crearConvenio(convenio('Convenio C', [evento('ev-c', 'Ingresa C')]));

    gs.eliminarConvenio(2);

    const porNombre = Object.fromEntries(
      gs.listarTodo().convenios.map(c => [c.nombre, c.historial.map(h => h.descripcion)]));
    expect(porNombre).toEqual({ 'Convenio A': ['Ingresa A'], 'Convenio C': ['Ingresa C'] });
    expect(filasHistorial()).toHaveLength(2);
  });

  it('borra varios eventos del mismo convenio de una vez', () => {
    gs.crearConvenio(convenio('Convenio A', [
      evento('ev-1', 'Ingresa'), evento('ev-2', 'Pasa a VRAC'), evento('ev-3', 'Visado'),
    ]));
    gs.crearConvenio(convenio('Convenio B', [evento('ev-b', 'Ingresa B')]));
    expect(filasHistorial()).toHaveLength(4);

    gs.eliminarConvenio(1);
    expect(filasHistorial()).toHaveLength(1);
  });

  it('no deja datos del solicitante al borrar una solicitud', () => {
    gs.crearSolicitud({
      materia: 'Copia de convenios 2025',
      solicitante: 'Juana Pérez',
      email: 'juana@example.cl',
      historial: [evento('ev-s1', 'Solicitud de Juana Pérez (juana@example.cl) ingresada')],
    });
    gs.eliminarSolicitud(1);

    expect(filasHistorial()).toHaveLength(0);
    expect(gs.crearSolicitud({ materia: 'Otra cosa', historial: [] }).id).toBe(2);
    expect(gs.listarTodo().solicitudes[0].historial).toEqual([]);
  });

  it('el historial de un convenio que sigue existiendo no se toca al actualizarlo', () => {
    gs.crearConvenio(convenio('Convenio A', [evento('ev-1', 'Ingresa')]));
    gs.actualizarConvenio({
      id: 1, nombre: 'Convenio A (corregido)', etapas: [],
      historial: [evento('ev-1', 'Ingresa'), evento('ev-2', 'Nombre actualizado')],
    });

    expect(gs.listarTodo().convenios[0].historial.map(h => h.id)).toEqual(['ev-1', 'ev-2']);
  });
});
