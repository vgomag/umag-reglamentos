import { describe, it, expect } from 'vitest';
import { crearSolicitud, PLAZOS_LEY_20285 } from '../config/transparencia';
import {
  fechaVencimiento, fechaTopeSubsanacion, fechaTopeOposicion, fechaTopeAmparo,
  infoPlazoSolicitud, textoPlazoSolicitud, solicitudCerrada, conVencimiento,
  resumenSolicitudes, filtrarSolicitudes, ordenarSolicitudes,
} from './transparenciaLogic';

// Datos reales del acuse de recibo UN016T0000633 (Universidad de Magallanes).
const SAI_REAL = crearSolicitud({
  id: 1,
  codigo: 'UN016T0000633',
  fechaIngreso: '2026-01-26',
  solicitante: 'Silvia Leiva Elgueta',
  materia: 'Copia del protocolo institucional de prevención de violencia de género',
});

describe('plazos de la Ley 20.285', () => {
  it('coinciden con los declarados en la ley', () => {
    expect(PLAZOS_LEY_20285.RESPUESTA.dias).toBe(20);
    expect(PLAZOS_LEY_20285.PRORROGA.dias).toBe(10);
    expect(PLAZOS_LEY_20285.SUBSANACION.dias).toBe(5);
    expect(PLAZOS_LEY_20285.AMPARO.dias).toBe(15);
  });

  it('reproduce la fecha de vencimiento del acuse de recibo real', () => {
    // El acuse informa: "Fecha de entrega vence el: 23/02/2026".
    expect(fechaVencimiento(SAI_REAL)).toBe('2026-02-23');
  });

  it('la prórroga suma 10 días hábiles adicionales', () => {
    const prorrogada = { ...SAI_REAL, prorrogada: true };
    expect(fechaVencimiento(prorrogada)).toBe('2026-03-09');
  });

  it('sin fecha de ingreso no hay vencimiento calculable', () => {
    expect(fechaVencimiento(crearSolicitud({}))).toBe('');
  });

  it('calcula el tope de subsanación sólo si fue requerida', () => {
    expect(fechaTopeSubsanacion(SAI_REAL)).toBe('');
    const conSubsanacion = { ...SAI_REAL, subsanacionSolicitada: true, fechaSubsanacion: '2026-01-28' };
    expect(fechaTopeSubsanacion(conSubsanacion)).toBe('2026-02-04');
  });

  it('calcula el tope de oposición de terceros (2 + 3 días hábiles)', () => {
    expect(fechaTopeOposicion(SAI_REAL)).toBe('');
    // 26-01 (lun) + 2 hábiles = 28-01; 28-01 + 3 hábiles = 02-02.
    const conTercero = { ...SAI_REAL, terceroInvolucrado: true };
    expect(fechaTopeOposicion(conTercero)).toBe('2026-02-02');
  });

  it('el amparo se cuenta desde la respuesta o desde el vencimiento', () => {
    expect(fechaTopeAmparo(SAI_REAL)).toBe('2026-03-16');
    const respondida = { ...SAI_REAL, fechaRespuesta: '2026-02-10' };
    expect(fechaTopeAmparo(respondida)).toBe('2026-03-03');
  });
});

describe('semáforo de solicitudes', () => {
  it('marca en plazo cuando faltan más de 5 días hábiles', () => {
    expect(infoPlazoSolicitud(SAI_REAL, '2026-02-02').key).toBe('en-plazo');
  });

  it('marca próxima a vencer dentro de los 5 días hábiles', () => {
    expect(infoPlazoSolicitud(SAI_REAL, '2026-02-18').key).toBe('por-vencer');
  });

  it('marca vencida pasada la fecha', () => {
    const info = infoPlazoSolicitud(SAI_REAL, '2026-02-25');
    expect(info.key).toBe('vencido');
    expect(textoPlazoSolicitud(SAI_REAL, '2026-02-25')).toContain('Vencido');
  });

  it('una solicitud respondida deja de consumir plazo', () => {
    const cerrada = { ...SAI_REAL, estado: 'Respondida' };
    expect(solicitudCerrada(cerrada)).toBe(true);
    expect(infoPlazoSolicitud(cerrada, '2026-03-30').key).toBe('finalizado');
  });

  it('conVencimiento expone la fecha para el calendario', () => {
    expect(conVencimiento(SAI_REAL).fechaVencimiento).toBe('2026-02-23');
  });
});

describe('listado de solicitudes', () => {
  const lista = [
    SAI_REAL,
    crearSolicitud({ id: 2, codigo: 'UN016T0000700', fechaIngreso: '2026-02-10', materia: 'Presupuesto 2026', estado: 'Respondida' }),
    crearSolicitud({ id: 3, codigo: 'UN016T0000650', fechaIngreso: '2026-02-02', materia: 'Nómina de contratas' }),
  ];

  it('resume el estado general', () => {
    const r = resumenSolicitudes(lista, '2026-02-25');
    expect(r.total).toBe(3);
    expect(r.cerradas).toBe(1);
    expect(r.enTramite).toBe(2);
    expect(r.respondidas).toBe(1);
  });

  it('filtra por texto, estado y situación', () => {
    expect(filtrarSolicitudes(lista, { busqueda: 'presupuesto' }).map(s => s.id)).toEqual([2]);
    expect(filtrarSolicitudes(lista, { estado: 'Respondida' }).map(s => s.id)).toEqual([2]);
    expect(filtrarSolicitudes(lista, { situacion: 'pendientes' }).map(s => s.id)).toEqual([1, 3]);
  });

  it('ordena por vencimiento más próximo', () => {
    expect(ordenarSolicitudes(lista, 'vencimiento').map(s => s.id)).toEqual([1, 3, 2]);
  });

  it('ordena por fecha de ingreso cuando se pide', () => {
    expect(ordenarSolicitudes(lista, 'ingreso').map(s => s.id)).toEqual([1, 3, 2]);
  });
});
