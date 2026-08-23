import { describe, it, expect } from 'vitest';
import {
  generarConveniosEjemplo, generarSolicitudesEjemplo, esRegistroEjemplo,
  PREFIJO_EJEMPLO, AVISO_EJEMPLO,
} from './datosEjemplo';
import { FLUJO_POR_DEFECTO, UNIDAD_IDS, ESTADOS_CONVENIO, ESTADOS_ETAPA } from './convenios';
import {
  estadoPlazo, ubicacionActual, estaFinalizado, pendienteDeRectoria,
  resumenConvenios, pendientesPorUnidad,
} from '../utils/conveniosLogic';
import { infoPlazoSolicitud } from '../utils/transparenciaLogic';
import { esFechaValida, esDiaHabil } from '../utils/fechas';

// Fecha fija y hábil (martes) para que los plazos calculados sean exactos.
const HOY = '2026-09-08';

describe('flujo por defecto', () => {
  it('sigue el orden de visación de la Res. N°216/2019', () => {
    // Primero la vicerrectoría temática, después VRAF, y al final PRO,
    // Contraloría y Rectoría.
    expect(FLUJO_POR_DEFECTO).toEqual(['VRAC', 'VRIIP', 'VVM', 'VRAF', 'PRO', 'CONTRALORIA', 'RECTORIA']);
  });

  it('VRAF va después de las tres vicerrectorías temáticas', () => {
    const vraf = FLUJO_POR_DEFECTO.indexOf('VRAF');
    ['VRAC', 'VRIIP', 'VVM'].forEach(u => {
      expect(FLUJO_POR_DEFECTO.indexOf(u)).toBeLessThan(vraf);
    });
  });

  it('Rectoría es siempre la última etapa', () => {
    expect(FLUJO_POR_DEFECTO[FLUJO_POR_DEFECTO.length - 1]).toBe('RECTORIA');
  });

  it('sólo contiene unidades conocidas y sin repetir', () => {
    FLUJO_POR_DEFECTO.forEach(u => expect(UNIDAD_IDS).toContain(u));
    expect(new Set(FLUJO_POR_DEFECTO).size).toBe(FLUJO_POR_DEFECTO.length);
  });
});

describe('convenios de ejemplo', () => {
  const convenios = generarConveniosEjemplo(HOY);

  it('genera ocho convenios con IDs únicos', () => {
    expect(convenios).toHaveLength(8);
    expect(new Set(convenios.map(c => c.id)).size).toBe(8);
  });

  it('todos quedan marcados como ejemplo y son reconocibles', () => {
    convenios.forEach(c => {
      expect(c.codigo.startsWith(PREFIJO_EJEMPLO)).toBe(true);
      expect(esRegistroEjemplo(c)).toBe(true);
      expect(c.observaciones).toContain(AVISO_EJEMPLO);
    });
  });

  it('no confunde un convenio real con uno de ejemplo', () => {
    expect(esRegistroEjemplo({ codigo: 'CONV-2026-014' })).toBe(false);
    expect(esRegistroEjemplo({ codigo: '' })).toBe(false);
    expect(esRegistroEjemplo({})).toBe(false);
    expect(esRegistroEjemplo(null)).toBe(false);
  });

  it('usa fechas válidas y estados admitidos', () => {
    convenios.forEach(c => {
      expect(esFechaValida(c.fechaIngreso)).toBe(true);
      expect(ESTADOS_CONVENIO).toContain(c.estado);
      if (c.fechaLimite) expect(esFechaValida(c.fechaLimite)).toBe(true);
      if (c.fechaEntregaRectoria) expect(esFechaValida(c.fechaEntregaRectoria)).toBe(true);
      c.etapas.forEach(e => {
        expect(UNIDAD_IDS).toContain(e.unidad);
        expect(ESTADOS_ETAPA).toContain(e.estado);
      });
    });
  });

  it('ninguna etapa termina antes de empezar', () => {
    convenios.forEach(c => {
      c.etapas.filter(e => e.fechaInicio && e.fechaTermino).forEach(e => {
        expect(e.fechaTermino >= e.fechaInicio).toBe(true);
      });
    });
  });

  it('ninguna etapa empieza antes del ingreso del convenio', () => {
    convenios.forEach(c => {
      c.etapas.filter(e => e.fechaInicio).forEach(e => {
        expect(e.fechaInicio >= c.fechaIngreso).toBe(true);
      });
    });
  });

  it('cubre los cinco estados del semáforo', () => {
    const estados = new Set(convenios.map(c => estadoPlazo(c, HOY)));
    expect(estados).toContain('vencido');
    expect(estados).toContain('por-vencer');
    expect(estados).toContain('en-plazo');
    expect(estados).toContain('sin-plazo');
    expect(estados).toContain('finalizado');
  });

  it('deja convenios repartidos en distintas ubicaciones del flujo', () => {
    const ubicaciones = new Set(convenios.map(ubicacionActual));
    expect(ubicaciones).toContain('INGRESADO');
    expect(ubicaciones).toContain('FINALIZADO');
    // Al menos tres unidades distintas con trabajo encima.
    const enUnidades = [...ubicaciones].filter(u => UNIDAD_IDS.includes(u));
    expect(enUnidades.length).toBeGreaterThanOrEqual(3);
  });

  it('incluye un finalizado y uno pendiente de Rectoría', () => {
    expect(convenios.filter(estaFinalizado)).toHaveLength(1);
    expect(convenios.filter(pendienteDeRectoria).length).toBeGreaterThanOrEqual(1);
  });

  it('los flujos son personalizados, no todos el flujo por defecto', () => {
    // La gracia del ejemplo es mostrar que no todas las unidades participan.
    const largos = new Set(convenios.map(c => c.etapas.length));
    expect(largos.size).toBeGreaterThan(1);
    convenios.forEach(c => expect(c.etapas.length).toBeLessThan(FLUJO_POR_DEFECTO.length + 1));
  });

  it('cada convenio trae historial y empieza por su creación', () => {
    convenios.forEach(c => {
      expect(c.historial.length).toBeGreaterThan(0);
      const primero = [...c.historial].sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
      expect(primero.descripcion).toContain('ingresado');
      // El primer evento coincide con la fecha de ingreso del convenio.
      expect(primero.fecha.slice(0, 10)).toBe(c.fechaIngreso);
    });
  });

  it('el dashboard queda con datos en todos sus indicadores clave', () => {
    const r = resumenConvenios(convenios, HOY);
    expect(r.total).toBe(8);
    expect(r.vencidos).toBe(1);
    expect(r.porVencer).toBe(1);
    expect(r.finalizados).toBe(1);
    expect(r.rectoria).toBeGreaterThanOrEqual(1);
    expect(r.conPlazo).toBeGreaterThanOrEqual(2);
    expect(r.recientes).toBeGreaterThanOrEqual(1);
  });

  it('reparte la carga entre varias unidades', () => {
    const porUnidad = pendientesPorUnidad(convenios);
    const conCarga = Object.entries(porUnidad).filter(([, n]) => n > 0);
    expect(conCarga.length).toBeGreaterThanOrEqual(4);
  });

  it('es determinista para una misma fecha', () => {
    expect(generarConveniosEjemplo(HOY)).toEqual(convenios);
  });

  it('se recalcula respecto de la fecha recibida', () => {
    const otros = generarConveniosEjemplo('2027-01-12');
    expect(otros[0].fechaIngreso).not.toBe(convenios[0].fechaIngreso);
    // El semáforo se mantiene: los ejemplos no envejecen.
    expect(new Set(otros.map(c => estadoPlazo(c, '2027-01-12'))))
      .toEqual(new Set(convenios.map(c => estadoPlazo(c, HOY))));
  });
});

describe('solicitudes de ejemplo', () => {
  const solicitudes = generarSolicitudesEjemplo(HOY);

  it('genera cuatro solicitudes marcadas como ejemplo', () => {
    expect(solicitudes).toHaveLength(4);
    solicitudes.forEach(s => {
      expect(esRegistroEjemplo(s)).toBe(true);
      expect(s.observaciones).toBe(AVISO_EJEMPLO);
      expect(esFechaValida(s.fechaIngreso)).toBe(true);
    });
  });

  it('todas ingresan en día hábil', () => {
    solicitudes.forEach(s => expect(esDiaHabil(s.fechaIngreso)).toBe(true));
  });

  it('cubre vencida, próxima a vencer y cerrada', () => {
    const estados = solicitudes.map(s => infoPlazoSolicitud(s, HOY).key);
    expect(estados).toContain('vencido');
    expect(estados).toContain('por-vencer');
    expect(estados).toContain('finalizado');
  });

  it('la prorrogada sigue en plazo gracias a los 10 días extra del Art. 14', () => {
    const prorrogada = solicitudes.find(s => s.prorrogada);
    expect(prorrogada).toBeDefined();
    // Sin prórroga ya estaría vencida (22 días hábiles transcurridos de 20).
    expect(infoPlazoSolicitud({ ...prorrogada, prorrogada: false }, HOY).key).toBe('vencido');
    expect(infoPlazoSolicitud(prorrogada, HOY).key).not.toBe('vencido');
  });

  it('no expone datos personales reales', () => {
    solicitudes.forEach(s => {
      expect(s.solicitante).toContain('ejemplo');
      expect(s.email).toContain('ejemplo');
    });
  });
});
