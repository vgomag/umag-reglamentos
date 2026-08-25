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
    deleteRows: (n, cuantas) => { filas.splice(n - 1, cuantas); },
    getRange: (r, c, nFilas, nCols) => ({
      getValues: () => Array.from({ length: nFilas }, (_, i) => {
        const fila = filas[r - 1 + i] || [];
        return Array.from({ length: nCols }, (_, j) => (fila[c - 1 + j] ?? ''));
      }),
      // Escribe celda por celda respetando la columna de inicio: la migración
      // de encabezados escribe a la derecha de los que ya existen, y un mock
      // que reemplazara la fila entera no la probaría de verdad.
      setValues: (valores) => {
        valores.forEach((v, i) => {
          const indice = r - 1 + i;
          while (filas.length <= indice) filas.push([]);
          v.forEach((valor, j) => { filas[indice][c - 1 + j] = valor; });
        });
      },
      setFontWeight: () => {},
    }),
  };
}

const CLIENT_ID_PRUEBA = '123-abc.apps.googleusercontent.com';
const CORREO_AUTORIZADO = 'ana@umag.cl';

function cargarScript() {
  const hojas = {};
  const propiedades = {};
  const respuestas = [];   // lo que el script devolvió por HTTP
  const servicios = {
    Utilities: {
      formatDate: (f) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`,
      computeDigest: () => [1, 2, 3],
      base64EncodeWebSafe: () => 'huella',
      DigestAlgorithm: { SHA_256: 'sha256' },
    },
    CacheService: {
      getScriptCache: () => ({ get: () => null, put: () => {} }),
    },
    // Google confirma la identidad del ID token; acá siempre dice que sí.
    UrlFetchApp: {
      fetch: () => ({
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify({
          aud: CLIENT_ID_PRUEBA, email_verified: 'true', email: CORREO_AUTORIZADO,
        }),
      }),
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
    ContentService: {
      createTextOutput: (texto) => { respuestas.push(texto); return { setMimeType: () => ({}) }; },
      MimeType: { JSON: 'json' },
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  };

  // La configuración del archivo del repo son valores de ejemplo; se
  // reemplazan para que verificarIdentidad pueda pasar.
  const exportar = `
    ; CLIENT_ID = ${JSON.stringify(CLIENT_ID_PRUEBA)};
    USUARIOS_AUTORIZADOS = [${JSON.stringify(CORREO_AUTORIZADO)}];
    TOKEN = 'token-de-prueba';
    return {
      crearConvenio, actualizarConvenio, eliminarConvenio,
      crearSolicitud, eliminarSolicitud,
      listarTodo, leerHoja, hoja, siguienteId, encabezadosConvenios,
      doGet, doPost,
      HOJA_HISTORIAL, HOJA_CONVENIOS,
    };`;
  // eslint-disable-next-line no-new-func
  const api = new Function(...Object.keys(servicios), codigo + exportar)(...Object.values(servicios));

  // Simula una petición HTTP y devuelve la respuesta ya parseada.
  const postear = (cuerpo) => {
    api.doPost({ postData: { contents: JSON.stringify({
      token: 'token-de-prueba', idToken: 'id-token-de-google', ...cuerpo,
    }) } });
    return JSON.parse(respuestas[respuestas.length - 1]);
  };
  const getear = () => {
    api.doGet({ parameter: {} });
    return JSON.parse(respuestas[respuestas.length - 1]);
  };

  return { ...api, hojas, propiedades, respuestas, postear, getear };
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

describe('orden del flujo', () => {
  const flujo = (unidades) => unidades.map((unidad, orden) => ({
    unidad, orden, fechaInicio: '', fechaTermino: '', estado: 'Pendiente', observaciones: '',
  }));

  it('sobrevive al guardado y a la relectura', () => {
    // La ficha permite reordenar la visación; antes ese orden volvía siempre al
    // fijo de UNIDADES en la siguiente carga.
    gs.crearConvenio({ nombre: 'Convenio A', etapas: flujo(['RECTORIA', 'VRAF', 'VRAC']), historial: [] });

    const [leido] = gs.listarTodo().convenios;
    expect(leido.etapas.map(e => e.unidad)).toEqual(['RECTORIA', 'VRAF', 'VRAC']);
  });

  it('un reordenamiento posterior también queda guardado', () => {
    gs.crearConvenio({ nombre: 'Convenio A', etapas: flujo(['VRAC', 'VRAF', 'PRO']), historial: [] });

    gs.actualizarConvenio({
      id: 1, nombre: 'Convenio A', etapas: flujo(['PRO', 'VRAC', 'VRAF']), historial: [],
    });

    expect(gs.listarTodo().convenios[0].etapas.map(e => e.unidad)).toEqual(['PRO', 'VRAC', 'VRAF']);
  });

  it('quitar una unidad no descoloca a las demás', () => {
    gs.crearConvenio({ nombre: 'Convenio A', etapas: flujo(['RECTORIA', 'VRAF', 'VRAC']), historial: [] });
    gs.actualizarConvenio({
      id: 1, nombre: 'Convenio A', etapas: flujo(['RECTORIA', 'VRAC']), historial: [],
    });

    const [leido] = gs.listarTodo().convenios;
    expect(leido.etapas.map(e => e.unidad)).toEqual(['RECTORIA', 'VRAC']);
  });
});

describe('migración de planillas ya existentes', () => {
  // Reproduce una hoja escrita por la versión anterior del script: los mismos
  // encabezados menos las columnas de orden, más una fila de datos.
  const encabezadosViejos = () => gs.encabezadosConvenios().filter(c => !c.endsWith('_orden'));

  // La hoja vieja se arma SIN pasar por hoja(), porque en producción ya existe
  // antes de la primera llamada de la petición: hoja() migra una sola vez por
  // ejecución, y montarla después no reproduciría el caso real.
  const planillaVieja = (valores = {}) => {
    const viejos = encabezadosViejos();
    const h = hojaFalsa(gs.HOJA_CONVENIOS);
    h.filas.push(viejos.slice());
    const fila = viejos.map(() => '');
    Object.entries(valores).forEach(([col, v]) => { fila[viejos.indexOf(col)] = v; });
    h.filas.push(fila);
    gs.hojas[gs.HOJA_CONVENIOS] = h;
    return { h, viejos };
  };

  it('agrega las columnas que faltan sin tocar las que ya están', () => {
    const { h, viejos } = planillaVieja({ id: 1, nombre: 'Convenio antiguo', VRAC_estado: 'Aprobado' });

    gs.hoja(gs.HOJA_CONVENIOS); // dispara la migración

    const encabezados = h.filas[0];
    expect(encabezados.slice(0, viejos.length)).toEqual(viejos); // ninguna se movió
    gs.encabezadosConvenios().forEach(c => expect(encabezados).toContain(c));
  });

  it('la fila de datos anterior queda intacta', () => {
    const { h, viejos } = planillaVieja({ id: 1, nombre: 'Convenio antiguo', VRAC_estado: 'Aprobado' });
    const filaAntes = h.filas[1].slice();

    gs.hoja(gs.HOJA_CONVENIOS);

    expect(h.filas[1].slice(0, viejos.length)).toEqual(filaAntes);
  });

  it('los datos anteriores se siguen leyendo, con el orden por defecto', () => {
    planillaVieja({
      id: 1, nombre: 'Convenio antiguo',
      VRAF_estado: 'En Revisión', VRAC_estado: 'Aprobado',
    });

    const [leido] = gs.listarTodo().convenios;

    expect(leido.nombre).toBe('Convenio antiguo');
    // Sin columna de orden se cae al flujo por defecto: VRAC (0) antes de VRAF (3).
    expect(leido.etapas.map(e => e.unidad)).toEqual(['VRAC', 'VRAF']);
    expect(leido.etapas.map(e => e.orden)).toEqual([0, 3]);
  });

  it('un convenio guardado después de migrar ya conserva su orden', () => {
    planillaVieja({ id: 1, nombre: 'Convenio antiguo', VRAC_estado: 'Aprobado' });

    gs.actualizarConvenio({
      id: 1, nombre: 'Convenio antiguo', historial: [],
      etapas: [
        { unidad: 'PRO', orden: 0, fechaInicio: '', fechaTermino: '', estado: 'Pendiente', observaciones: '' },
        { unidad: 'VRAC', orden: 1, fechaInicio: '', fechaTermino: '', estado: 'Aprobado', observaciones: '' },
      ],
    });

    expect(gs.listarTodo().convenios[0].etapas.map(e => e.unidad)).toEqual(['PRO', 'VRAC']);
  });

  it('no vuelve a agregar columnas si ya están todas', () => {
    gs.hoja(gs.HOJA_CONVENIOS);
    const anchoInicial = gs.hojas.Convenios.filas[0].length;

    gs.hoja(gs.HOJA_CONVENIOS);
    gs.hoja(gs.HOJA_CONVENIOS);

    expect(gs.hojas.Convenios.filas[0].length).toBe(anchoInicial);
  });
});

describe('lecturas por POST', () => {
  // El ID token dejó de viajar en la URL, así que listar y ping entran por
  // doPost como cualquier otra operación.

  it('listar devuelve los datos', () => {
    gs.crearConvenio({ nombre: 'Convenio A', etapas: [], historial: [] });

    const r = gs.postear({ accion: 'listar' });

    expect(r.ok).toBe(true);
    expect(r.datos.convenios.map(c => c.nombre)).toEqual(['Convenio A']);
    expect(r.datos.solicitudes).toEqual([]);
  });

  it('ping responde con la identidad y la versión', () => {
    const r = gs.postear({ accion: 'ping' });

    expect(r.ok).toBe(true);
    expect(r.datos.pong).toBe(true);
    expect(r.datos.email).toBe(CORREO_AUTORIZADO);
    expect(r.datos.version).toBe(r.version);
  });

  it('sin identidad válida no entrega nada', () => {
    gs.crearConvenio({ nombre: 'Convenio reservado', etapas: [], historial: [] });

    const r = gs.postear({ accion: 'listar', idToken: '' });

    expect(r.ok).toBe(false);
    expect(r.noAutorizado).toBe(true);
    expect(r.datos).toBeUndefined();
  });

  it('un token de aplicación equivocado tampoco', () => {
    const r = gs.postear({ accion: 'listar', token: 'otro-token' });

    expect(r.ok).toBe(false);
    expect(r.error).toBe('Token inválido');
    expect(r.datos).toBeUndefined();
  });

  it('las escrituras siguen funcionando por el mismo camino', () => {
    const r = gs.postear({ accion: 'crear', entidad: 'convenio', datos: { nombre: 'Nuevo', etapas: [], historial: [] } });

    expect(r.ok).toBe(true);
    expect(r.datos.id).toBe(1);
    expect(gs.postear({ accion: 'listar' }).datos.convenios).toHaveLength(1);
  });

  it('una acción desconocida se rechaza', () => {
    const r = gs.postear({ accion: 'inventada', entidad: 'convenio' });

    expect(r.ok).toBe(false);
    expect(r.error).toContain('no reconocida');
  });

  it('todas las respuestas informan la versión, incluidos los rechazos', () => {
    expect(gs.postear({ accion: 'listar' }).version).toBeTruthy();
    expect(gs.postear({ accion: 'listar', idToken: '' }).version).toBeTruthy();
    expect(gs.postear({ accion: 'listar', token: 'malo' }).version).toBeTruthy();
  });
});

describe('doGet ya no atiende lecturas', () => {
  it('no entrega datos ni siquiera con credenciales válidas', () => {
    gs.crearConvenio({ nombre: 'Convenio reservado', etapas: [], historial: [] });

    const r = gs.getear();

    expect(r.ok).toBe(false);
    expect(r.datos).toBeUndefined();
  });

  it('explica qué hacer en vez de dar un error críptico', () => {
    // Una pestaña con el sitio viejo cargado sigue pidiendo por GET.
    expect(gs.getear().error).toContain('Recarga la aplicación');
  });
});

describe('el cache de ejecución no puede servir datos viejos', () => {
  // Cada `it` usa una instancia recién cargada, que es lo que dura una petición
  // HTTP. Dentro de un mismo `it` todo ocurre en la MISMA ejecución, así que es
  // ahí donde el cache podría quedar desfasado. Si alguien agrega una escritura
  // y olvida invalidar, estas pruebas lo delatan.

  it('un convenio creado se ve de inmediato al listar', () => {
    gs.crearConvenio(convenio('Recién creado'));

    expect(gs.listarTodo().convenios.map(c => c.nombre)).toEqual(['Recién creado']);
  });

  it('dos creaciones seguidas no comparten id ni se pisan', () => {
    const a = gs.crearConvenio(convenio('Primero'));
    const b = gs.crearConvenio(convenio('Segundo'));

    expect([a.id, b.id]).toEqual([1, 2]);
    expect(gs.listarTodo().convenios.map(c => c.nombre)).toEqual(['Primero', 'Segundo']);
  });

  it('un convenio actualizado se relee con los datos nuevos', () => {
    gs.crearConvenio(convenio('Nombre viejo'));
    gs.actualizarConvenio({ id: 1, nombre: 'Nombre nuevo', etapas: [], historial: [] });

    expect(gs.listarTodo().convenios[0].nombre).toBe('Nombre nuevo');
  });

  it('un convenio eliminado desaparece de la misma lectura', () => {
    gs.crearConvenio(convenio('Efímero'));
    gs.eliminarConvenio(1);

    expect(gs.listarTodo().convenios).toEqual([]);
  });

  it('el historial recién escrito viaja en la respuesta', () => {
    gs.crearConvenio(convenio('Con historia', [evento('ev-1', 'Ingresa')]));

    expect(gs.listarTodo().convenios[0].historial.map(h => h.descripcion)).toEqual(['Ingresa']);
  });

  it('el historial borrado tampoco reaparece', () => {
    gs.crearConvenio(convenio('A', [evento('ev-a', 'Ingresa A')]));
    gs.crearConvenio(convenio('B', [evento('ev-b', 'Ingresa B')]));
    gs.eliminarConvenio(1);

    const [queda] = gs.listarTodo().convenios;
    expect(queda.nombre).toBe('B');
    expect(gs.leerHoja(gs.HOJA_HISTORIAL).filas).toHaveLength(1);
  });

  it('las solicitudes llevan su propia cuenta, sin contaminarse', () => {
    gs.crearConvenio(convenio('Un convenio'));
    gs.crearSolicitud({ materia: 'Una solicitud', historial: [] });

    const todo = gs.listarTodo();
    expect(todo.convenios).toHaveLength(1);
    expect(todo.solicitudes).toHaveLength(1);
  });
});

describe('borrado del historial por tramos', () => {
  it('quita todos los eventos aunque no estén seguidos en la hoja', () => {
    // A y B se intercalan, así que las filas de A no son contiguas.
    gs.crearConvenio(convenio('A', [evento('a1', 'A uno')]));
    gs.crearConvenio(convenio('B', [evento('b1', 'B uno')]));
    gs.actualizarConvenio({
      id: 1, nombre: 'A', etapas: [],
      historial: [evento('a1', 'A uno'), evento('a2', 'A dos')],
    });

    gs.eliminarConvenio(1);

    const quedan = gs.leerHoja(gs.HOJA_HISTORIAL).filas.map(f => f[2]);
    expect(quedan).toEqual(['b1']);
  });

  it('un tramo largo y contiguo se borra entero', () => {
    const muchos = Array.from({ length: 12 }, (_, i) => evento(`e${i}`, `Evento ${i}`));
    gs.crearConvenio(convenio('Con doce', muchos));
    gs.crearConvenio(convenio('Otro', [evento('otro', 'Otro')]));

    gs.eliminarConvenio(1);

    expect(gs.leerHoja(gs.HOJA_HISTORIAL).filas.map(f => f[2])).toEqual(['otro']);
  });
});
