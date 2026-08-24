import { describe, it, expect } from 'vitest';
import { crearConvenio, crearEtapas, normalizarConvenio, TIPOS_HISTORIAL } from '../config/convenios';
import {
  infoPlazo, estadoPlazo, textoPlazo, etapaActual, ubicacionActual, etiquetaUbicacion,
  progresoConvenio, enTramite, pendienteDeRectoria, estaFinalizado, tienePlazoEspecial,
  filtrarConvenios, ordenarConvenios, hayFiltrosActivos, calcularEventos, conHistorial,
  hayFiltrosAvanzados, CAMPOS_FILTRO_AVANZADO, FILTROS_VACIOS,
  resumenConvenios, pendientesPorUnidad, conteoPorCampo, tiempoPromedioTramitacion,
  ingresadoRecientemente, entregadoARectoria,
} from './conveniosLogic';

const HOY = '2026-03-10';

// Convenio de prueba con etapas en un estado concreto.
function convenio(props = {}, estadosEtapa = {}) {
  const base = crearConvenio({ id: 1, nombre: 'Convenio de prueba', fechaIngreso: '2026-02-01', ...props });
  return normalizarConvenio({
    ...base,
    etapas: base.etapas.map(e => ({ ...e, ...(estadosEtapa[e.unidad] || {}) })),
  });
}

describe('semáforo de plazos', () => {
  it('sin fecha límite queda en 🔵 sin plazo especial', () => {
    const c = convenio();
    expect(estadoPlazo(c, HOY)).toBe('sin-plazo');
    expect(infoPlazo(c, HOY).icono).toBe('🔵');
    expect(textoPlazo(c, HOY)).toBe('Sin plazo especial');
  });

  it('con fecha límite lejana queda en 🟢 en plazo', () => {
    expect(estadoPlazo(convenio({ fechaLimite: '2026-04-30' }), HOY)).toBe('en-plazo');
  });

  it('dentro de los 7 días de alerta queda en 🟡 próximo a vencer', () => {
    expect(estadoPlazo(convenio({ fechaLimite: '2026-03-15' }), HOY)).toBe('por-vencer');
    expect(estadoPlazo(convenio({ fechaLimite: HOY }), HOY)).toBe('por-vencer');
  });

  it('con fecha límite pasada queda en 🔴 vencido', () => {
    const c = convenio({ fechaLimite: '2026-03-01' });
    expect(estadoPlazo(c, HOY)).toBe('vencido');
    expect(textoPlazo(c, HOY)).toContain('Vencido hace 9');
  });

  it('un convenio finalizado deja de consumir plazo y queda ⚫', () => {
    const c = convenio({ fechaLimite: '2026-03-01', estado: 'Finalizado' });
    expect(estadoPlazo(c, HOY)).toBe('finalizado');
    expect(estaFinalizado(c)).toBe(true);
  });

  it('reconoce el plazo especial por la bandera o por la fecha', () => {
    expect(tienePlazoEspecial(convenio())).toBe(false);
    expect(tienePlazoEspecial(convenio({ plazoEspecial: true }))).toBe(true);
    expect(tienePlazoEspecial(convenio({ fechaLimite: '2026-05-01' }))).toBe(true);
  });
});

describe('ubicación en el flujo', () => {
  it('un convenio recién ingresado aparece como Ingresado', () => {
    const c = convenio();
    expect(ubicacionActual(c)).toBe('INGRESADO');
    expect(etiquetaUbicacion(c)).toBe('Ingresado');
  });

  it('ubica el convenio en la unidad que lo tiene en revisión', () => {
    const c = convenio({}, {
      VRAF: { estado: 'Aprobado', fechaInicio: '2026-02-02', fechaTermino: '2026-02-10' },
      VRAC: { estado: 'En Revisión', fechaInicio: '2026-02-11' },
    });
    expect(ubicacionActual(c)).toBe('VRAC');
    expect(etapaActual(c).unidad).toBe('VRAC');
    expect(enTramite(c)).toBe(true);
  });

  it('una etapa observada también retiene el convenio', () => {
    const c = convenio({}, { VRAF: { estado: 'Observado' } });
    expect(ubicacionActual(c)).toBe('VRAF');
  });

  it('ignora las unidades marcadas No Aplica', () => {
    const c = convenio({}, {
      VRAF: { estado: 'No Aplica' },
      VRAC: { estado: 'En Revisión' },
    });
    expect(ubicacionActual(c)).toBe('VRAC');
    expect(etapaActual(c).unidad).toBe('VRAC');
  });

  it('detecta cuando está pendiente de Rectoría', () => {
    const enRectoria = convenio({}, { RECTORIA: { estado: 'En Revisión' } });
    expect(pendienteDeRectoria(enRectoria)).toBe(true);
    expect(pendienteDeRectoria(convenio({ estado: 'Pendiente Rectoría' }))).toBe(true);
    expect(pendienteDeRectoria(convenio({ estado: 'Finalizado' }))).toBe(false);
  });

  it('respeta un flujo personalizado y no el flujo por defecto', () => {
    const c = normalizarConvenio(crearConvenio({
      id: 9, nombre: 'Sólo VRAF y Rectoría', etapas: crearEtapas(['VRAF', 'RECTORIA']),
    }));
    expect(c.etapas).toHaveLength(2);
    expect(c.etapas.map(e => e.unidad)).toEqual(['VRAF', 'RECTORIA']);
  });
});

describe('progreso', () => {
  it('es 0 sin avance y 100 al finalizar', () => {
    expect(progresoConvenio(convenio())).toBe(0);
    expect(progresoConvenio(convenio({ estado: 'Finalizado' }))).toBe(100);
  });

  it('nunca llega a 100 mientras el convenio siga abierto', () => {
    const todasAprobadas = convenio({}, Object.fromEntries(
      ['VRAF', 'VRAC', 'VRIIP', 'VVM', 'PRO', 'CONTRALORIA', 'RECTORIA'].map(u => [u, { estado: 'Aprobado' }]),
    ));
    expect(progresoConvenio(todasAprobadas)).toBe(99);
  });
});

describe('filtros', () => {
  const lista = [
    convenio({ id: 1, nombre: 'Convenio Hospital', unidadOrigen: 'Medicina', fechaIngreso: '2026-01-10', fechaLimite: '2026-03-01' }),
    convenio({ id: 2, nombre: 'Convenio Municipal', unidadOrigen: 'Ingeniería', fechaIngreso: '2026-02-15' }),
    convenio({ id: 3, nombre: 'Convenio finalizado', unidadOrigen: 'Medicina', fechaIngreso: '2025-12-01', estado: 'Finalizado', fechaEntregaRectoria: '2026-01-20' }),
  ];

  it('busca sin distinguir mayúsculas ni tildes', () => {
    expect(filtrarConvenios(lista, { busqueda: 'ingenieria' }, HOY).map(c => c.id)).toEqual([2]);
    expect(filtrarConvenios(lista, { busqueda: 'HOSPITAL' }, HOY).map(c => c.id)).toEqual([1]);
  });

  it('filtra por unidad de origen y por estado', () => {
    expect(filtrarConvenios(lista, { unidadOrigen: 'Medicina' }, HOY)).toHaveLength(2);
    expect(filtrarConvenios(lista, { estado: 'Finalizado' }, HOY).map(c => c.id)).toEqual([3]);
  });

  it('filtra por rango de fecha de ingreso', () => {
    expect(filtrarConvenios(lista, { ingresoDesde: '2026-01-01' }, HOY).map(c => c.id)).toEqual([1, 2]);
    expect(filtrarConvenios(lista, { ingresoHasta: '2026-01-31' }, HOY).map(c => c.id)).toEqual([1, 3]);
  });

  it('filtra por fecha de entrega a Rectoría', () => {
    expect(filtrarConvenios(lista, { entregaDesde: '2026-01-01' }, HOY).map(c => c.id)).toEqual([3]);
  });

  it('filtra por presencia de plazo y por vencimiento', () => {
    expect(filtrarConvenios(lista, { plazo: 'con-plazo' }, HOY).map(c => c.id)).toEqual([1]);
    expect(filtrarConvenios(lista, { plazo: 'sin-plazo' }, HOY).map(c => c.id)).toEqual([2, 3]);
    expect(filtrarConvenios(lista, { plazo: 'vencido' }, HOY).map(c => c.id)).toEqual([1]);
  });

  it('filtra por situación', () => {
    expect(filtrarConvenios(lista, { situacion: 'pendientes' }, HOY).map(c => c.id)).toEqual([1, 2]);
    expect(filtrarConvenios(lista, { situacion: 'finalizados' }, HOY).map(c => c.id)).toEqual([3]);
  });

  it('sin filtros devuelve todo', () => {
    expect(filtrarConvenios(lista, {}, HOY)).toHaveLength(3);
    expect(hayFiltrosActivos({})).toBe(false);
    expect(hayFiltrosActivos({ estado: 'Ingresado' })).toBe(true);
  });
});

describe('ordenamiento', () => {
  const a = convenio({ id: 1, nombre: 'Zeta', fechaIngreso: '2026-02-01' });
  const b = convenio({ id: 2, nombre: 'Alfa', fechaIngreso: '2026-01-05', fechaLimite: '2026-03-01' });
  const c = convenio({ id: 3, nombre: 'Beta', fechaIngreso: '' });

  it('por defecto ordena por orden de llegada', () => {
    expect(ordenarConvenios([a, b, c], 'llegada', HOY).map(x => x.id)).toEqual([2, 1, 3]);
  });

  it('deja al final los convenios sin fecha, también al invertir', () => {
    expect(ordenarConvenios([a, b, c], 'ingreso-desc', HOY).map(x => x.id)).toEqual([1, 2, 3]);
  });

  it('el orden por urgencia pone primero los vencidos', () => {
    expect(ordenarConvenios([a, b, c], 'urgencia', HOY)[0].id).toBe(2);
  });

  it('ordena alfabéticamente', () => {
    expect(ordenarConvenios([a, b, c], 'nombre', HOY).map(x => x.nombre)).toEqual(['Alfa', 'Beta', 'Zeta']);
  });

  it('no muta el arreglo original', () => {
    const original = [a, b, c];
    ordenarConvenios(original, 'nombre', HOY);
    expect(original.map(x => x.id)).toEqual([1, 2, 3]);
  });
});

describe('historial y trazabilidad', () => {
  it('registra la creación cuando no hay versión anterior', () => {
    const eventos = calcularEventos(null, convenio(), 'ana');
    expect(eventos).toHaveLength(1);
    expect(eventos[0].tipo).toBe(TIPOS_HISTORIAL.CREACION);
    expect(eventos[0].usuario).toBe('ana');
  });

  it('registra cambio de estado y finalización', () => {
    const antes = convenio();
    const despues = { ...antes, estado: 'Finalizado' };
    const tipos = calcularEventos(antes, despues).map(e => e.tipo);
    expect(tipos).toContain(TIPOS_HISTORIAL.ESTADO);
    expect(tipos).toContain(TIPOS_HISTORIAL.FINALIZACION);
  });

  it('registra los cambios de plazo con las fechas antigua y nueva', () => {
    const antes = convenio();
    const despues = { ...antes, fechaLimite: '2026-05-20' };
    const ev = calcularEventos(antes, despues).find(e => e.tipo === TIPOS_HISTORIAL.PLAZO);
    expect(ev.descripcion).toContain('sin plazo');
    expect(ev.descripcion).toContain('20-05-2026');
  });

  it('registra la entrega a Rectoría', () => {
    const antes = convenio();
    const despues = { ...antes, fechaEntregaRectoria: '2026-03-05' };
    expect(calcularEventos(antes, despues).some(e => e.tipo === TIPOS_HISTORIAL.RECTORIA)).toBe(true);
  });

  it('registra derivación y término de etapa', () => {
    const antes = convenio();
    const despues = convenio({}, { VRAF: { estado: 'En Revisión', fechaInicio: '2026-02-05', fechaTermino: '2026-02-12' } });
    const tipos = calcularEventos(antes, despues).map(e => e.tipo);
    expect(tipos).toContain(TIPOS_HISTORIAL.DERIVACION);
    expect(tipos).toContain(TIPOS_HISTORIAL.ETAPA);
  });

  it('no inventa eventos cuando nada cambió', () => {
    const c = convenio();
    expect(calcularEventos(c, { ...c })).toHaveLength(0);
    expect(conHistorial(c, { ...c }).historial).toHaveLength(0);
  });

  it('conHistorial acumula sobre el historial existente', () => {
    const antes = convenio();
    const despues = { ...antes, estado: 'En Tramitación' };
    const resultado = conHistorial(antes, despues, 'ana');
    expect(resultado.historial.length).toBeGreaterThan(0);
    expect(resultado.estado).toBe('En Tramitación');
  });
});

describe('métricas del dashboard', () => {
  const lista = [
    convenio({ id: 1, fechaIngreso: '2026-03-01', fechaLimite: '2026-03-01' }),
    convenio({ id: 2, fechaIngreso: '2026-02-20' }, { VRAF: { estado: 'En Revisión', fechaInicio: '2026-02-21' } }),
    convenio({ id: 3, fechaIngreso: '2025-11-01', estado: 'Finalizado', fechaEntregaRectoria: '2026-01-15' }),
    convenio({ id: 4, fechaIngreso: '2026-03-05' }, { RECTORIA: { estado: 'En Revisión' } }),
  ];

  it('resume los indicadores del panel', () => {
    const r = resumenConvenios(lista, HOY);
    expect(r.total).toBe(4);
    expect(r.finalizados).toBe(1);
    expect(r.pendientes).toBe(3);
    expect(r.vencidos).toBe(1);
    expect(r.rectoria).toBe(1);
    expect(r.recientes).toBe(3);
  });

  it('cuenta los pendientes en cada unidad', () => {
    const porUnidad = pendientesPorUnidad(lista);
    expect(porUnidad.VRAF).toBe(1);
    expect(porUnidad.RECTORIA).toBe(1);
    expect(porUnidad.INGRESADO).toBe(1);
  });

  it('los finalizados no cuentan como carga de ninguna unidad', () => {
    const total = Object.values(pendientesPorUnidad(lista)).reduce((s, n) => s + n, 0);
    expect(total).toBe(3);
  });

  it('agrupa por campo', () => {
    const conteo = conteoPorCampo(lista, 'unidadOrigen');
    expect(conteo[0][1]).toBe(4);
  });

  it('calcula el tiempo promedio de tramitación de los finalizados', () => {
    expect(tiempoPromedioTramitacion(lista)).toBe(75);
    expect(tiempoPromedioTramitacion([])).toBeNull();
  });

  it('detecta ingresos recientes y entregas a Rectoría', () => {
    expect(ingresadoRecientemente(lista[0], HOY)).toBe(true);
    expect(ingresadoRecientemente(lista[2], HOY)).toBe(false);
    expect(entregadoARectoria(lista[2])).toBe(true);
    expect(entregadoARectoria(lista[0])).toBe(false);
  });
});

describe('historial del orden del flujo', () => {
  const etapas = (unidades) => unidades.map((unidad, orden) => ({
    unidad, orden, fechaInicio: '', fechaTermino: '', estado: 'Pendiente', observaciones: '',
  }));
  const base = (unidades) => ({
    id: 1, nombre: 'Convenio', estado: 'Ingresado', prioridad: 'normal',
    fechaLimite: '', fechaIngreso: '2026-01-10', fechaEntregaRectoria: '',
    etapas: etapas(unidades), historial: [],
  });
  const descripciones = (a, b) => calcularEventos(a, b, 'ana@umag.cl').map(e => e.descripcion);

  it('anota el reordenamiento con la secuencia resultante', () => {
    const antes = base(['VRAC', 'VRAF', 'PRO']);
    const despues = base(['PRO', 'VRAC', 'VRAF']);

    const orden = descripciones(antes, despues).filter(d => d.startsWith('Orden del flujo'));
    expect(orden).toEqual(['Orden del flujo: «VRAC → VRAF → PRO» ahora es «PRO → VRAC → VRAF»']);
  });

  it('el antes y el después se distinguen a simple vista', () => {
    // Con una flecha separándolos, la frase era una fila de unidades sin
    // principio ni fin: "VRAC → VRAF → PRO → PRO → VRAC → VRAF".
    const [descripcion] = descripciones(base(['VRAC', 'VRAF', 'PRO']), base(['PRO', 'VRAC', 'VRAF']))
      .filter(d => d.startsWith('Orden del flujo'));

    expect(descripcion.split('«')).toHaveLength(3);
    expect(descripcion).toContain('ahora es');
  });

  it('no anota nada si el orden no cambió', () => {
    const antes = base(['VRAC', 'VRAF']);
    expect(descripciones(antes, base(['VRAC', 'VRAF']))).toEqual([]);
  });

  it('un alta no se confunde con un reordenamiento', () => {
    const d = descripciones(base(['VRAC']), base(['VRAC', 'PRO']));

    expect(d.some(x => x.includes('Se agregó la etapa'))).toBe(true);
    expect(d.some(x => x.startsWith('Orden del flujo'))).toBe(false);
  });

  it('una baja tampoco', () => {
    const d = descripciones(base(['VRAC', 'PRO']), base(['VRAC']));

    expect(d.some(x => x.includes('Se quitó la etapa'))).toBe(true);
    expect(d.some(x => x.startsWith('Orden del flujo'))).toBe(false);
  });

  it('un solo evento aunque se muevan varias unidades', () => {
    const d = descripciones(base(['VRAC', 'VRAF', 'PRO']), base(['PRO', 'VRAF', 'VRAC']));
    expect(d.filter(x => x.startsWith('Orden del flujo'))).toHaveLength(1);
  });
});

describe('hayFiltrosAvanzados', () => {
  it('reconoce los filtros que viven en el panel de fechas', () => {
    CAMPOS_FILTRO_AVANZADO.forEach(campo => {
      expect(hayFiltrosAvanzados({ ...FILTROS_VACIOS, [campo]: '2026-01-01' })).toBe(true);
    });
  });

  it('un filtro de la barra visible no obliga a abrir el panel', () => {
    expect(hayFiltrosAvanzados({ ...FILTROS_VACIOS, situacion: 'finalizados' })).toBe(false);
    expect(hayFiltrosAvanzados({ ...FILTROS_VACIOS, busqueda: 'convenio' })).toBe(false);
    expect(hayFiltrosAvanzados({ ...FILTROS_VACIOS, plazo: 'vencido' })).toBe(false);
  });

  it('sin filtros, cerrado', () => {
    expect(hayFiltrosAvanzados(FILTROS_VACIOS)).toBe(false);
    expect(hayFiltrosAvanzados({})).toBe(false);
    expect(hayFiltrosAvanzados()).toBe(false);
  });

  it('todos sus campos son filtros reconocidos', () => {
    CAMPOS_FILTRO_AVANZADO.forEach(campo => {
      expect(Object.keys(FILTROS_VACIOS)).toContain(campo);
    });
  });
});
