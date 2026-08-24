import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import App from './App';
import * as sheets from './config/sheetsStore';
import { STORAGE_KEY } from './config/conveniosStore';
import { ultimoAnioConFeriados } from './utils/fechas';

/**
 * Pruebas de la app completa contra una planilla simulada.
 *
 * Los módulos de dominio ya se prueban aislados; lo que se verifica acá es el
 * cableado de App, que es donde estaban los dos problemas: cambios que decían
 * "guardado ✓" sin llegar nunca a la planilla, y un fallo de red que dejaba la
 * app en modo local para siempre.
 */

vi.mock('./config/auth', () => ({
  GOOGLE_CLIENT_ID: 'client-id-de-prueba',
  googleConfigurado: () => true,
  leerSesion: () => 'token-de-prueba',
  guardarSesion: vi.fn(),
  cerrarSesion: vi.fn(),
  usuarioDeSesion: () => ({ email: 'ana@umag.cl', nombre: 'Ana', foto: '', expira: 0 }),
  montarBotonGoogle: vi.fn(() => Promise.resolve({})),
}));

vi.mock('./config/sheetsStore', () => ({
  sheetsConfigurado: vi.fn(() => true),
  fetchTodo: vi.fn(),
  crearConvenioRemoto: vi.fn(),
  actualizarConvenioRemoto: vi.fn(),
  eliminarConvenioRemoto: vi.fn(),
  crearSolicitudRemota: vi.fn(),
  actualizarSolicitudRemota: vi.fn(),
  eliminarSolicitudRemota: vi.fn(),
  probarConexion: vi.fn(() => Promise.resolve({ ok: true, error: null })),
  SHEET_URL: '',
  DRIVE_FOLDER_URL: '',
}));

const convenio = (id, nombre) => ({
  id, nombre, codigo: `CONV-${id}`, unidadOrigen: 'VRAC', fechaIngreso: '2026-01-10',
  estado: 'Ingresado', etapas: [], historial: [],
});

const planillaCon = (convenios) => ({
  data: { convenios, solicitudes: [] }, error: null,
});
const planillaCaida = (error = 'HTTP 500 Internal Server Error') => ({
  data: null, error, noAutorizado: false,
});

// ── navegación y lectura de la vista Configuración ──────────────────
async function irAConfiguracion() {
  fireEvent.click(screen.getByText('Configuración'));
  return screen.findByRole('button', { name: /Borrar todos los convenios/ });
}

async function conveniosRegistrados() {
  const fila = (await screen.findByText('Convenios registrados')).closest('tr');
  return Number(fila.querySelector('td').textContent);
}

// El aviso de "sin conexión" es el único role="alert" de la app. Se busca por
// rol y no por texto porque Configuración muestra el mismo texto en su tabla.
const avisoSinConexion = () => screen.queryByRole('alert');

let confirmar;
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  sheets.sheetsConfigurado.mockReturnValue(true);
  sheets.fetchTodo.mockResolvedValue(planillaCon([]));
  confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => { confirmar.mockRestore(); });

/* ================================================================== */

describe('borrar todos los convenios', () => {
  it('los borra también en la planilla, no sólo en pantalla', async () => {
    sheets.fetchTodo.mockResolvedValue(planillaCon([convenio(1, 'Convenio A'), convenio(2, 'Convenio B')]));
    sheets.eliminarConvenioRemoto.mockResolvedValue({ ok: true, datos: {} });

    render(<App />);
    fireEvent.click(await irAConfiguracion());

    await waitFor(() => {
      expect(sheets.eliminarConvenioRemoto.mock.calls.map(c => c[0])).toEqual([1, 2]);
    });
    expect(await conveniosRegistrados()).toBe(0);
  });

  it('el convenio que la planilla no borró sigue en pantalla', async () => {
    sheets.fetchTodo.mockResolvedValue(planillaCon([convenio(1, 'Convenio A'), convenio(2, 'Convenio B')]));
    sheets.eliminarConvenioRemoto.mockImplementation(async (id) => (id === 2
      ? { ok: false, error: 'HTTP 500' }
      : { ok: true, datos: {} }));

    render(<App />);
    fireEvent.click(await irAConfiguracion());

    // Se borró uno de dos: la pantalla tiene que reflejar la planilla, no el deseo.
    await waitFor(async () => { expect(await conveniosRegistrados()).toBe(1); });
    expect(await screen.findByText(/quedaron sin cambios en la planilla/)).toBeTruthy();
  });

  it('sin confirmar no toca la planilla', async () => {
    sheets.fetchTodo.mockResolvedValue(planillaCon([convenio(1, 'Convenio A')]));
    confirmar.mockReturnValue(false);

    render(<App />);
    fireEvent.click(await irAConfiguracion());

    await waitFor(async () => { expect(await conveniosRegistrados()).toBe(1); });
    expect(sheets.eliminarConvenioRemoto).not.toHaveBeenCalled();
  });
});

describe('importar convenios', () => {
  const importar = async (container, contenido) => {
    const input = container.querySelector('input[type="file"]');
    const archivo = new File([JSON.stringify(contenido)], 'respaldo.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [archivo] } });
  };

  it('los crea en la planilla, no sólo en el estado local', async () => {
    sheets.fetchTodo.mockResolvedValue(planillaCon([convenio(1, 'Convenio A')]));
    sheets.crearConvenioRemoto.mockResolvedValue({ ok: true, datos: { id: 77 } });

    const { container } = render(<App />);
    await irAConfiguracion();
    await importar(container, { convenios: [{ nombre: 'Convenio importado', etapas: [], historial: [] }] });

    await waitFor(() => { expect(sheets.crearConvenioRemoto).toHaveBeenCalledTimes(1); });
    expect(await conveniosRegistrados()).toBe(2);
  });

  it('descarta el id del archivo: lo asigna la planilla', async () => {
    // Si se respetara el id del respaldo, pisaría un convenio existente.
    sheets.fetchTodo.mockResolvedValue(planillaCon([convenio(1, 'Convenio A')]));
    sheets.crearConvenioRemoto.mockResolvedValue({ ok: true, datos: { id: 42 } });

    const { container } = render(<App />);
    await irAConfiguracion();
    await importar(container, { convenios: [{ id: 1, nombre: 'Choca con el 1', etapas: [], historial: [] }] });

    await waitFor(() => { expect(sheets.crearConvenioRemoto).toHaveBeenCalledTimes(1); });
    expect(sheets.crearConvenioRemoto.mock.calls[0][0].id).toBeUndefined();
    expect(await conveniosRegistrados()).toBe(2);
  });

  it('si la planilla los rechaza no aparecen como importados', async () => {
    sheets.fetchTodo.mockResolvedValue(planillaCon([]));
    sheets.crearConvenioRemoto.mockResolvedValue({ ok: false, error: 'HTTP 500' });

    const { container } = render(<App />);
    await irAConfiguracion();
    await importar(container, { convenios: [{ nombre: 'No entra', etapas: [], historial: [] }] });

    expect(await screen.findByText(/No se pudo importar ninguno/)).toBeTruthy();
    expect(await conveniosRegistrados()).toBe(0);
  });
});

describe('planilla sin responder', () => {
  const seedLocal = (convenios) => localStorage.setItem(STORAGE_KEY, JSON.stringify(convenios));

  it('avisa en pantalla en vez de pasar a local en silencio', async () => {
    seedLocal([convenio(1, 'Convenio A')]);
    sheets.fetchTodo.mockResolvedValue(planillaCaida());

    render(<App />);

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent', expect.stringContaining('Sin conexión con la planilla'));
  });

  it('sigue mostrando la copia local para poder consultar', async () => {
    seedLocal([convenio(1, 'Convenio guardado antes')]);
    sheets.fetchTodo.mockResolvedValue(planillaCaida());

    render(<App />);
    await irAConfiguracion();

    expect(await conveniosRegistrados()).toBe(1);
  });

  it('no deja borrar: los cambios se perderían al reconectar', async () => {
    seedLocal([convenio(1, 'Convenio A')]);
    sheets.fetchTodo.mockResolvedValue(planillaCaida());

    render(<App />);
    fireEvent.click(await irAConfiguracion());

    expect(await screen.findByText(/No se puede borrar los convenios/)).toBeTruthy();
    expect(sheets.eliminarConvenioRemoto).not.toHaveBeenCalled();
    expect(await conveniosRegistrados()).toBe(1);
  });

  it('no deja importar', async () => {
    seedLocal([]);
    sheets.fetchTodo.mockResolvedValue(planillaCaida());

    const { container } = render(<App />);
    await irAConfiguracion();
    const input = container.querySelector('input[type="file"]');
    const archivo = new File([JSON.stringify({ convenios: [{ nombre: 'X', etapas: [], historial: [] }] })],
      'respaldo.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [archivo] } });

    expect(await screen.findByText(/No se puede importar los convenios/)).toBeTruthy();
    expect(sheets.crearConvenioRemoto).not.toHaveBeenCalled();
  });

  it('«Reintentar» recupera el modo planilla y trae los datos', async () => {
    seedLocal([]);
    sheets.fetchTodo.mockResolvedValueOnce(planillaCaida());
    render(<App />);

    const reintentar = await screen.findByRole('button', { name: /Reintentar/ });
    sheets.fetchTodo.mockResolvedValue(planillaCon([convenio(1, 'Llegó tras reconectar')]));
    fireEvent.click(reintentar);

    await waitFor(() => { expect(avisoSinConexion()).toBeNull(); });
    await irAConfiguracion();
    expect(await conveniosRegistrados()).toBe(1);
  });

  it('tras reconectar vuelve a escribir en la planilla', async () => {
    seedLocal([]);
    sheets.fetchTodo.mockResolvedValueOnce(planillaCaida());
    sheets.eliminarConvenioRemoto.mockResolvedValue({ ok: true, datos: {} });
    render(<App />);

    const reintentar = await screen.findByRole('button', { name: /Reintentar/ });
    sheets.fetchTodo.mockResolvedValue(planillaCon([convenio(1, 'Convenio A')]));
    fireEvent.click(reintentar);

    fireEvent.click(await irAConfiguracion());
    await waitFor(() => { expect(sheets.eliminarConvenioRemoto).toHaveBeenCalledWith(1); });
  });

  it('un fallo al escribir también levanta el aviso', async () => {
    // La planilla respondía al entrar pero se cayó después: el aviso tiene que
    // aparecer igual, en vez de dejar que se siga intentando a ciegas.
    sheets.fetchTodo.mockResolvedValue(planillaCon([convenio(1, 'Convenio A')]));
    sheets.eliminarConvenioRemoto.mockResolvedValue({ ok: false, error: 'La planilla no respondió a tiempo' });

    render(<App />);
    fireEvent.click(await irAConfiguracion());

    await waitFor(() => { expect(avisoSinConexion()).not.toBeNull(); });
    // El convenio sigue en pantalla: la planilla nunca lo borró.
    expect(await conveniosRegistrados()).toBe(1);
  });
});

describe('plazos fuera de la tabla de feriados', () => {
  const solicitud = (id, fechaIngreso) => ({
    id, codigo: `UN016T${id}`, fechaIngreso, materia: 'Copia de convenios',
    solicitante: 'Juana Pérez', estado: 'Ingresada', etapa: 'Ingreso y recepción', historial: [],
  });
  const marcaDudosa = () => screen.queryByTitle(/tabla de feriados está incompleta/);

  const irATransparencia = () => {
    fireEvent.click(screen.getByText('Transparencia pasiva'));
    return screen.findByText(/Solicitudes de acceso a la información/);
  };

  it('marca en el listado la solicitud cuyo plazo no es de fiar', async () => {
    const fuera = ultimoAnioConFeriados() + 1;
    sheets.fetchTodo.mockResolvedValue({
      data: { convenios: [], solicitudes: [solicitud(1, `${fuera}-03-02`)] }, error: null,
    });

    render(<App />);
    await irATransparencia();

    expect(marcaDudosa()).not.toBeNull();
  });

  it('no marca las que sí están dentro de la cobertura', async () => {
    const dentro = ultimoAnioConFeriados();
    sheets.fetchTodo.mockResolvedValue({
      data: { convenios: [], solicitudes: [solicitud(1, `${dentro}-03-02`)] }, error: null,
    });

    render(<App />);
    await irATransparencia();

    expect(marcaDudosa()).toBeNull();
  });
});

describe('exportación CSV', () => {
  it('el archivo descargado no lleva fórmulas vivas', async () => {
    const blobs = [];
    URL.createObjectURL = vi.fn((blob) => { blobs.push(blob); return 'blob:falso'; });
    URL.revokeObjectURL = vi.fn();

    sheets.fetchTodo.mockResolvedValue(planillaCon([{
      ...convenio(1, '=HYPERLINK("http://sitio-externo","Ver informe")'),
    }]));

    render(<App />);
    fireEvent.click(screen.getByText('Reportes'));
    fireEvent.click(await screen.findByRole('button', { name: /Convenios en CSV/ }));

    await waitFor(() => { expect(blobs).toHaveLength(1); });
    const contenido = await blobs[0].text();
    expect(contenido).toContain(`"'=HYPERLINK`);
    expect(contenido).not.toContain('"=HYPERLINK');
  });
});

describe('sin planilla configurada', () => {
  it('trabaja en local, sin avisos de conexión y sin llamar a la planilla', async () => {
    sheets.sheetsConfigurado.mockReturnValue(false);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([convenio(1, 'Convenio local')]));

    render(<App />);
    fireEvent.click(await irAConfiguracion());

    await waitFor(async () => { expect(await conveniosRegistrados()).toBe(0); });
    expect(avisoSinConexion()).toBeNull();
    expect(sheets.fetchTodo).not.toHaveBeenCalled();
    expect(sheets.eliminarConvenioRemoto).not.toHaveBeenCalled();
  });
});

describe('filtros del listado de convenios', () => {
  const irAlListado = async () => {
    fireEvent.click(screen.getByText('Convenios'));
    return screen.findByPlaceholderText(/Buscar por nombre/);
  };
  const cuenta = () => screen.getByText(/\d+ de \d+ convenios/).textContent;

  const conConvenios = () => sheets.fetchTodo.mockResolvedValue(planillaCon([
    { ...convenio(1, 'Convenio en trámite'), estado: 'En Tramitación' },
    { ...convenio(2, 'Convenio finalizado'), estado: 'Finalizado' },
    { ...convenio(3, 'Convenio anulado'), estado: 'Anulado' },
  ]));

  it('la tarjeta del dashboard aplica su filtro', async () => {
    conConvenios();
    render(<App />);

    // La tarjeta ya navega al listado; no hay que pasar por el menú.
    fireEvent.click(await screen.findByText('Finalizados'));
    await screen.findByPlaceholderText(/Buscar por nombre/);

    expect(cuenta()).toBe('1 de 3 convenios');
  });

  it('entrar por el menú lateral NO arrastra el filtro de la tarjeta', async () => {
    // Éste era el problema: la lista aparecía recortada por un criterio que
    // venía de otra navegación y nada explicaba.
    conConvenios();
    render(<App />);

    fireEvent.click(await screen.findByText('Finalizados'));
    await screen.findByPlaceholderText(/Buscar por nombre/);
    expect(cuenta()).toBe('1 de 3 convenios');

    fireEvent.click(screen.getByText('Dashboard'));
    await screen.findByText('Panel de Convenios');
    await irAlListado();

    expect(cuenta()).toBe('3 de 3 convenios');
  });

  it('volver desde una ficha SÍ conserva lo que se había filtrado', async () => {
    conConvenios();
    render(<App />);
    const buscador = await irAlListado();

    fireEvent.change(buscador, { target: { value: 'anulado' } });
    await waitFor(() => { expect(cuenta()).toBe('1 de 3 convenios'); });

    fireEvent.click(screen.getByRole('button', { name: 'Ver' }));
    await screen.findByText('Flujo de tramitación');
    fireEvent.click(screen.getByRole('button', { name: /Volver al listado/ }));

    const vuelto = await screen.findByPlaceholderText(/Buscar por nombre/);
    expect(vuelto.value).toBe('anulado');
    expect(cuenta()).toBe('1 de 3 convenios');
  });

  it('el filtro de la tarjeta también sobrevive al ir y volver de una ficha', async () => {
    conConvenios();
    render(<App />);

    fireEvent.click(await screen.findByText('Finalizados'));
    await screen.findByPlaceholderText(/Buscar por nombre/);

    fireEvent.click(screen.getByRole('button', { name: 'Ver' }));
    await screen.findByText('Flujo de tramitación');
    fireEvent.click(screen.getByRole('button', { name: /Volver al listado/ }));

    await screen.findByPlaceholderText(/Buscar por nombre/);
    expect(cuenta()).toBe('1 de 3 convenios');
  });

  it('«Limpiar filtros» deja la lista completa', async () => {
    conConvenios();
    render(<App />);

    fireEvent.click(await screen.findByText('Finalizados'));
    await screen.findByPlaceholderText(/Buscar por nombre/);
    fireEvent.click(screen.getByText(/Limpiar filtros/));

    await waitFor(() => { expect(cuenta()).toBe('3 de 3 convenios'); });
  });

  it('un filtro de fecha llega con el panel abierto, uno de estado no', async () => {
    // Si el panel quedara cerrado, la lista saldría recortada por un criterio
    // invisible; abrirlo siempre sería ruido.
    conConvenios();
    render(<App />);

    fireEvent.click(await screen.findByText('Finalizados'));
    await screen.findByPlaceholderText(/Buscar por nombre/);
    expect(screen.queryByText('Ingreso desde')).toBeNull();
  });
});

describe('avisos', () => {
  const avisoEnPantalla = () => document.querySelector('.toast');

  it('cada aviso es un elemento nuevo, no el anterior reescrito', async () => {
    // App le pone una `key` distinta a cada aviso para que React lo monte de
    // nuevo. Si reutilizara la instancia, el aviso heredaría el temporizador a
    // medio correr del anterior y podía pasar casi sin verse.
    sheets.fetchTodo.mockResolvedValue(planillaCon([]));
    render(<App />);
    await irAConfiguracion();

    const actualizar = screen.getByRole('button', { name: /Actualizar desde la planilla/ });

    fireEvent.click(actualizar);
    await waitFor(() => { expect(avisoEnPantalla()).not.toBeNull(); });
    const primero = avisoEnPantalla();

    fireEvent.click(actualizar);
    await waitFor(() => { expect(avisoEnPantalla()).not.toBe(primero); });

    expect(avisoEnPantalla().textContent).toContain('Datos actualizados');
  });
});
