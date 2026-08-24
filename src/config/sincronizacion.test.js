import { describe, it, expect, vi } from 'vitest';
import {
  crearLoteRemoto, eliminarLoteRemoto, huboRechazoDeAcceso, avisoLote,
} from './sincronizacion';

// La planilla asigna el id; `normalizar` es la del dominio (acá, la identidad).
const identidad = (x) => x;

describe('crearLoteRemoto', () => {
  it('crea todo y devuelve los ids que asignó la planilla', async () => {
    let siguiente = 10;
    const crear = vi.fn(async () => ({ ok: true, datos: { id: siguiente++ } }));

    const { creados, fallidos } = await crearLoteRemoto(
      [{ nombre: 'A' }, { nombre: 'B' }], crear, identidad);

    expect(fallidos).toEqual([]);
    expect(creados).toEqual([{ nombre: 'A', id: 10 }, { nombre: 'B', id: 11 }]);
  });

  it('recorre de a uno, no en paralelo', async () => {
    // Si fuera en paralelo, la planilla asignaría el mismo id dos veces.
    const orden = [];
    const crear = vi.fn(async (r) => {
      orden.push(`inicia ${r.nombre}`);
      await new Promise(resolve => setTimeout(resolve, 0));
      orden.push(`termina ${r.nombre}`);
      return { ok: true, datos: { id: orden.length } };
    });

    await crearLoteRemoto([{ nombre: 'A' }, { nombre: 'B' }], crear, identidad);
    expect(orden).toEqual(['inicia A', 'termina A', 'inicia B', 'termina B']);
  });

  it('separa los que fallaron sin abortar el resto', async () => {
    const crear = vi.fn(async (r) => (r.nombre === 'B'
      ? { ok: false, error: 'HTTP 500' }
      : { ok: true, datos: { id: 1 } }));

    const { creados, fallidos } = await crearLoteRemoto(
      [{ nombre: 'A' }, { nombre: 'B' }, { nombre: 'C' }], crear, identidad);

    expect(creados.map(c => c.nombre)).toEqual(['A', 'C']);
    expect(fallidos).toEqual([{ registro: { nombre: 'B' }, error: 'HTTP 500', noAutorizado: false }]);
  });

  it('marca los rechazos por identidad', async () => {
    const crear = vi.fn(async () => ({ ok: false, error: 'Sesión expirada', noAutorizado: true }));
    const { fallidos } = await crearLoteRemoto([{ nombre: 'A' }], crear, identidad);

    expect(fallidos[0].noAutorizado).toBe(true);
    expect(huboRechazoDeAcceso(fallidos)).toBe(true);
  });

  it('con lista vacía no llama a la planilla', async () => {
    const crear = vi.fn();
    const { creados, fallidos } = await crearLoteRemoto([], crear, identidad);

    expect(crear).not.toHaveBeenCalled();
    expect(creados).toEqual([]);
    expect(fallidos).toEqual([]);
  });
});

describe('eliminarLoteRemoto', () => {
  it('elimina todo y devuelve los registros borrados', async () => {
    const eliminar = vi.fn(async () => ({ ok: true }));
    const registros = [{ id: 1 }, { id: 2 }, { id: 3 }];

    const { eliminados, fallidos } = await eliminarLoteRemoto(registros, eliminar);

    expect(eliminar.mock.calls.map(c => c[0])).toEqual([1, 2, 3]);
    expect(eliminados).toEqual(registros);
    expect(fallidos).toEqual([]);
  });

  it('el que falla NO aparece como eliminado', async () => {
    // Es lo que decide si el convenio sigue en pantalla: sacarlo cuando la
    // planilla no lo borró dejaría la app mintiendo sobre lo que hay.
    const eliminar = vi.fn(async (id) => (id === 2 ? { ok: false, error: 'HTTP 500' } : { ok: true }));

    const { eliminados, fallidos } = await eliminarLoteRemoto([{ id: 1 }, { id: 2 }, { id: 3 }], eliminar);

    expect(eliminados.map(r => r.id)).toEqual([1, 3]);
    expect(fallidos.map(f => f.registro.id)).toEqual([2]);
  });

  it('sigue con los siguientes aunque falle el primero', async () => {
    const eliminar = vi.fn(async (id) => (id === 1 ? { ok: false, error: 'x' } : { ok: true }));
    const { eliminados } = await eliminarLoteRemoto([{ id: 1 }, { id: 2 }], eliminar);

    expect(eliminar).toHaveBeenCalledTimes(2);
    expect(eliminados.map(r => r.id)).toEqual([2]);
  });
});

describe('avisoLote', () => {
  it('todo bien: aviso de éxito con la cuenta', () => {
    expect(avisoLote([{}, {}], [], 'importados', 'convenio')).toEqual({
      type: 'success', message: '2 convenios importados.',
    });
  });

  it('uno solo va en singular', () => {
    expect(avisoLote([{}], [], 'importados', 'convenio').message).toBe('1 convenio importados.');
  });

  it('nada bien: aviso de error, sin fingir que pasó algo', () => {
    const aviso = avisoLote([], [{ error: 'HTTP 500' }, { error: 'HTTP 500' }], 'importados', 'convenio');

    expect(aviso.type).toBe('error');
    expect(aviso.message).toContain('ninguno');
    expect(aviso.message).toContain('HTTP 500');
  });

  it('a medias: dice cuántos quedaron sin cambios en la planilla', () => {
    const aviso = avisoLote([{}, {}], [{ error: 'HTTP 500' }], 'eliminados', 'convenio');

    expect(aviso.type).toBe('error');
    expect(aviso.message).toContain('2 de 3');
    expect(aviso.message).toContain('1 quedaron sin cambios');
  });
});
