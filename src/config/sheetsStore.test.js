import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// El módulo lee import.meta.env al cargarse, así que se define antes de importarlo.
const API_URL = 'https://script.google.com/macros/s/AKfy-prueba/exec';
vi.stubEnv('VITE_SHEETS_API_URL', API_URL);
vi.stubEnv('VITE_SHEETS_TOKEN', 'token-de-prueba');

const {
  sheetsConfigurado, fetchTodo, probarConexion,
  crearConvenioRemoto, actualizarConvenioRemoto, eliminarConvenioRemoto,
  crearSolicitudRemota, eliminarSolicitudRemota, getUltimoErrorSheets,
} = await import('./sheetsStore');

// Respuesta mínima con la forma que devuelve fetch.
const respuesta = (cuerpo, { ok = true, status = 200 } = {}) => ({
  ok, status, statusText: ok ? 'OK' : 'Error',
  text: async () => (typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)),
});

beforeEach(() => { vi.restoreAllMocks(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('configuración', () => {
  it('se considera configurado cuando hay URL', () => {
    expect(sheetsConfigurado()).toBe(true);
  });
});

describe('lectura', () => {
  it('pide los datos por POST, con las credenciales en el cuerpo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      respuesta({ ok: true, datos: { convenios: [{ id: 1 }], solicitudes: [] } }));
    vi.stubGlobal('fetch', fetchMock);

    const { data, error } = await fetchTodo();

    expect(error).toBeNull();
    expect(data.convenios).toHaveLength(1);
    const [url, opciones] = fetchMock.mock.calls[0];
    expect(url).toBe(API_URL);
    expect(opciones.method).toBe('POST');
    expect(JSON.parse(opciones.body)).toMatchObject({ accion: 'listar', token: 'token-de-prueba' });
  });

  it('devuelve listas vacías si la planilla no trae nada', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({ ok: true, datos: {} })));
    const { data } = await fetchTodo();
    expect(data).toEqual({ convenios: [], solicitudes: [] });
  });

  it('informa el error del script sin lanzar excepción', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      respuesta({ ok: false, error: 'Token inválido' })));
    const { data, error } = await fetchTodo();
    expect(data).toBeNull();
    expect(error).toBe('Token inválido');
    expect(getUltimoErrorSheets().op).toBe('listar');
  });

  it('explica el caso típico de implementación no pública (respuesta HTML)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta('<!DOCTYPE html><html>...')));
    const { error } = await fetchTodo();
    expect(error).toContain('Cualquier usuario');
  });

  it('informa los errores HTTP', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      respuesta('', { ok: false, status: 500 })));
    const { error } = await fetchTodo();
    expect(error).toContain('500');
  });

  it('no propaga fallos de red', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')));
    const { data, error } = await fetchTodo();
    expect(data).toBeNull();
    expect(error).toBe('Failed to fetch');
  });
});

describe('escritura', () => {
  it('envía text/plain para no disparar preflight CORS', async () => {
    // Apps Script no sabe responder OPTIONS: si se enviara application/json,
    // el navegador haría preflight y la petición fallaría siempre.
    const fetchMock = vi.fn().mockResolvedValue(respuesta({ ok: true, datos: { id: 7 } }));
    vi.stubGlobal('fetch', fetchMock);

    await crearConvenioRemoto({ nombre: 'Convenio X' });

    const [, opciones] = fetchMock.mock.calls[0];
    expect(opciones.method).toBe('POST');
    expect(opciones.headers['Content-Type']).toBe('text/plain;charset=utf-8');
  });

  it('manda acción, entidad, token y datos en el cuerpo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuesta({ ok: true, datos: { id: 7 } }));
    vi.stubGlobal('fetch', fetchMock);

    await crearConvenioRemoto({ nombre: 'Convenio X' });

    const cuerpo = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(cuerpo).toMatchObject({
      token: 'token-de-prueba',
      accion: 'crear',
      entidad: 'convenio',
      datos: { nombre: 'Convenio X' },
    });
  });

  it('devuelve el id que asignó la planilla', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({ ok: true, datos: { id: 42 } })));
    const { ok, datos } = await crearConvenioRemoto({ nombre: 'X' });
    expect(ok).toBe(true);
    expect(datos.id).toBe(42);
  });

  it('usa la acción correcta en cada operación', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuesta({ ok: true, datos: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await actualizarConvenioRemoto({ id: 1 });
    await eliminarConvenioRemoto(3);
    await crearSolicitudRemota({ codigo: 'UN016' });
    await eliminarSolicitudRemota(5);

    const cuerpos = fetchMock.mock.calls.map(c => JSON.parse(c[1].body));
    expect(cuerpos.map(c => `${c.accion}:${c.entidad}`)).toEqual([
      'actualizar:convenio', 'eliminar:convenio', 'crear:solicitud', 'eliminar:solicitud',
    ]);
    expect(cuerpos[1].datos).toEqual({ id: 3 });
    expect(cuerpos[3].datos).toEqual({ id: 5 });
  });

  it('devuelve ok:false ante un error, sin lanzar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      respuesta({ ok: false, error: 'Acción no reconocida' })));
    const resultado = await crearConvenioRemoto({ nombre: 'X' });
    expect(resultado.ok).toBe(false);
    expect(resultado.error).toBe('Acción no reconocida');
  });

  it('traduce el corte por tiempo a un mensaje legible', async () => {
    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));
    const { ok, error } = await crearConvenioRemoto({ nombre: 'X' });
    expect(ok).toBe(false);
    expect(error).toBe('La planilla no respondió a tiempo');
  });
});

describe('comprobación de conexión', () => {
  it('confirma cuando el script responde al ping', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuesta({ ok: true, datos: { pong: true } }));
    vi.stubGlobal('fetch', fetchMock);
    const { ok } = await probarConexion();
    expect(ok).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).accion).toBe('ping');
  });

  it('reporta el motivo cuando falla', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({ ok: false, error: 'Token inválido' })));
    const { ok, error } = await probarConexion();
    expect(ok).toBe(false);
    expect(error).toBe('Token inválido');
  });
});

describe('versión del script publicado', () => {
  it('la devuelve al comprobar la conexión', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      respuesta({ version: '7', ok: true, datos: { pong: true, version: '7' } })));

    expect((await probarConexion()).version).toBe('7');
  });

  it('la devuelve TAMBIÉN cuando la planilla rechaza la petición', async () => {
    // Es el caso que importa: saber qué código está publicado sirve sobre todo
    // cuando algo falla, y ahí nunca se llega a los datos.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      respuesta({ version: '7', ok: false, error: 'Sesión no iniciada.', noAutorizado: true })));

    const { ok, version, noAutorizado } = await probarConexion();

    expect(ok).toBe(false);
    expect(noAutorizado).toBe(true);
    expect(version).toBe('7');
  });

  it('viaja en la lectura de datos y en las escrituras', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      respuesta({ version: '7', ok: true, datos: { convenios: [], solicitudes: [] } })));
    expect((await fetchTodo()).version).toBe('7');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      respuesta({ version: '7', ok: true, datos: { id: 3 } })));
    const creado = await crearConvenioRemoto({ nombre: 'X' });
    expect(creado.version).toBe('7');
    expect(creado.datos).toEqual({ id: 3 });   // el parámetro `datos` no se pisa
  });

  it('queda vacía si el script publicado es anterior y no la informa', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      respuesta({ ok: true, datos: { pong: true } })));

    expect((await probarConexion()).version).toBe('');
  });

  it('queda vacía cuando la respuesta ni siquiera es JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta('<!doctype html><html>')));

    const { ok, version } = await probarConexion();

    expect(ok).toBe(false);
    expect(version).toBe('');
  });
});

describe('el ID token no viaja en la URL', () => {
  // Como parámetro de la URL, la credencial de Google quedaba escrita en los
  // registros de ejecución de Apps Script, en el historial del navegador y en
  // cualquier proxy intermedio. En el cuerpo de un POST no queda en ninguno.
  // leerSesion() descarta lo que no sea un ID token vigente, así que hay que
  // armar uno con forma real y caducidad futura.
  const b64 = (obj) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const TOKEN_DE_SESION = `${b64({ alg: 'RS256' })}`
    + `.${b64({ email: 'ana@umag.cl', exp: Math.floor(Date.now() / 1000) + 3600 })}`
    + '.firma-no-verificada';

  const espiarPeticiones = () => {
    const fetchMock = vi.fn().mockResolvedValue(respuesta({ ok: true, datos: {} }));
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.setItem('umag_google_token', TOKEN_DE_SESION);
    return fetchMock;
  };

  const urlsDe = (fetchMock) => fetchMock.mock.calls.map(c => c[0]);
  const cuerposDe = (fetchMock) => fetchMock.mock.calls.map(c => JSON.parse(c[1].body));

  it('al leer los datos', async () => {
    const fetchMock = espiarPeticiones();
    await fetchTodo();

    urlsDe(fetchMock).forEach(url => {
      expect(url).toBe(API_URL);
      expect(url).not.toContain('idToken');
    });
  });

  it('al comprobar la conexión', async () => {
    const fetchMock = espiarPeticiones();
    await probarConexion();

    urlsDe(fetchMock).forEach(url => {
      expect(url).toBe(API_URL);
      expect(url).not.toContain('idToken');
    });
  });

  it('al escribir', async () => {
    const fetchMock = espiarPeticiones();
    await crearConvenioRemoto({ nombre: 'Convenio X' });
    await eliminarConvenioRemoto(3);

    urlsDe(fetchMock).forEach(url => expect(url).toBe(API_URL));
  });

  it('ninguna petición lleva jamás una query', async () => {
    const fetchMock = espiarPeticiones();
    await fetchTodo();
    await probarConexion();
    await crearConvenioRemoto({ nombre: 'Convenio X' });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    urlsDe(fetchMock).forEach(url => expect(url).not.toContain('?'));
  });

  it('pero sí llega en el cuerpo, que es donde tiene que ir', async () => {
    const fetchMock = espiarPeticiones();
    await fetchTodo();
    await probarConexion();

    cuerposDe(fetchMock).forEach(cuerpo => {
      expect(cuerpo.idToken).toBe(TOKEN_DE_SESION);
    });
  });
});
