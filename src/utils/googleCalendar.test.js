import { describe, it, expect } from 'vitest';
import { crearConvenio, normalizarConvenio } from '../config/convenios';
import { crearSolicitud } from '../config/transparencia';
import { conVencimiento } from './transparenciaLogic';
import {
  eventosDeConvenio, eventosDeConvenios, eventosDeSolicitud, agruparPorFecha,
  urlGoogleCalendar, generarICS, googleConfigurado, estadoIntegracion,
  crearSincronizador, describirEvento,
} from './googleCalendar';

const CONVENIO = normalizarConvenio(crearConvenio({
  id: 7,
  codigo: 'CONV-2026-007',
  nombre: 'Convenio con Hospital Clínico',
  fechaIngreso: '2026-02-02',
  fechaLimite: '2026-04-15',
  fechaEntregaRectoria: '2026-04-01',
  etapas: [
    { unidad: 'VRAF', orden: 0, estado: 'Aprobado', fechaInicio: '2026-02-05', fechaTermino: '2026-02-20', observaciones: '' },
    { unidad: 'VRAC', orden: 1, estado: 'No Aplica', fechaInicio: '2026-03-01', fechaTermino: '', observaciones: '' },
  ],
}));

describe('derivación de eventos', () => {
  it('genera un evento por cada fecha relevante del convenio', () => {
    const tipos = eventosDeConvenio(CONVENIO).map(e => e.tipo);
    expect(tipos).toContain('ingreso');
    expect(tipos).toContain('limite');
    expect(tipos).toContain('rectoria');
    expect(tipos).toContain('etapa-inicio');
    expect(tipos).toContain('etapa-termino');
  });

  it('omite las etapas marcadas No Aplica', () => {
    const eventos = eventosDeConvenio(CONVENIO);
    expect(eventos.some(e => e.titulo.includes('VRAC'))).toBe(false);
  });

  it('ignora las fechas vacías', () => {
    const vacio = normalizarConvenio(crearConvenio({ id: 8, nombre: 'Sin fechas' }));
    expect(eventosDeConvenio(vacio)).toHaveLength(0);
    expect(eventosDeConvenio(null)).toHaveLength(0);
  });

  it('los identificadores son estables y únicos (permiten upsert sin duplicar)', () => {
    const primera = eventosDeConvenio(CONVENIO).map(e => e.uid);
    const segunda = eventosDeConvenio(CONVENIO).map(e => e.uid);
    expect(primera).toEqual(segunda);
    expect(new Set(primera).size).toBe(primera.length);
  });

  it('ordena cronológicamente al combinar varios convenios', () => {
    const fechas = eventosDeConvenios([CONVENIO]).map(e => e.fecha);
    expect([...fechas].sort()).toEqual(fechas);
  });

  it('genera los eventos de una solicitud de transparencia', () => {
    const sai = conVencimiento(crearSolicitud({ id: 3, codigo: 'UN016T0000633', fechaIngreso: '2026-01-26', materia: 'Protocolo' }));
    const eventos = eventosDeSolicitud(sai);
    expect(eventos.map(e => e.tipo)).toEqual(['sai-ingreso', 'sai-vencimiento']);
    expect(eventos[1].fecha).toBe('2026-02-23');
  });

  it('agrupa por fecha para pintar el calendario', () => {
    const mapa = agruparPorFecha(eventosDeConvenio(CONVENIO));
    expect(mapa['2026-02-02']).toHaveLength(1);
  });

  it('describe un evento de forma legible', () => {
    const ev = eventosDeConvenio(CONVENIO)[0];
    expect(describirEvento(ev)).toContain('02-02-2026');
  });
});

describe('enlace a Google Calendar', () => {
  it('arma la URL de creación de evento de día completo', () => {
    const ev = eventosDeConvenio(CONVENIO).find(e => e.tipo === 'limite');
    const url = urlGoogleCalendar(ev);
    expect(url).toContain('calendar.google.com');
    expect(url).toContain('action=TEMPLATE');
    // DTEND es exclusivo: el día siguiente al del evento.
    expect(url).toContain('dates=20260415%2F20260416');
  });

  it('devuelve cadena vacía si el evento no tiene fecha válida', () => {
    expect(urlGoogleCalendar({ titulo: 'x', fecha: '' })).toBe('');
    expect(urlGoogleCalendar(null)).toBe('');
  });
});

describe('exportación .ics', () => {
  const ics = generarICS(eventosDeConvenio(CONVENIO), 'Convenios UMAG');

  it('produce un calendario iCalendar válido', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('VERSION:2.0');
  });

  it('usa CRLF como separador de línea, según RFC 5545', () => {
    expect(ics).toContain('\r\n');
  });

  it('incluye un VEVENT por cada evento', () => {
    const eventos = eventosDeConvenio(CONVENIO);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(eventos.length);
    expect(ics.match(/END:VEVENT/g)).toHaveLength(eventos.length);
  });

  it('usa fechas de día completo', () => {
    expect(ics).toContain('DTSTART;VALUE=DATE:20260415');
    expect(ics).toContain('DTEND;VALUE=DATE:20260416');
  });

  it('escapa las comas del texto', () => {
    const conComa = [{ uid: 'x', fecha: '2026-05-01', titulo: 'Uno, dos y tres', descripcion: '', tipoLabel: 'Test' }];
    expect(generarICS(conComa)).toContain('SUMMARY:Uno\\, dos y tres');
  });

  it('con lista vacía sigue produciendo un calendario válido', () => {
    const vacio = generarICS([]);
    expect(vacio).toContain('BEGIN:VCALENDAR');
    expect(vacio).not.toContain('BEGIN:VEVENT');
  });
});

describe('estado de la integración', () => {
  it('sin credenciales reporta que la sincronización automática no está disponible', () => {
    expect(googleConfigurado({ clientId: '', calendarId: '' })).toBe(false);
    const estado = estadoIntegracion();
    expect(estado.exportacionICS).toBe(true);
    expect(estado.enlaceDirecto).toBe(true);
    expect(estado.sincronizacionAutomatica).toBe(false);
  });

  it('el sincronizador por defecto no está disponible pero sí puede exportar', async () => {
    const sync = crearSincronizador();
    expect(sync.disponible()).toBe(false);
    const resultado = await sync.sincronizar([{ uid: 'x' }]);
    expect(resultado.ok).toBe(false);
    expect(resultado.pendientes).toBe(1);
    expect(typeof sync.exportar).toBe('function');
  });
});
