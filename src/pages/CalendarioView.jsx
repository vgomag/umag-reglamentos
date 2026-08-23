import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  eventosDeConvenios, eventosDeSolicitud, agruparPorFecha, urlGoogleCalendar,
  descargarICS, TIPOS_EVENTO, estadoIntegracion,
} from '../utils/googleCalendar';
import { hoyISO, toISO, formatFecha, nombreMes, esFeriado } from '../utils/fechas';
import { conVencimiento } from '../utils/transparenciaLogic';

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// Matriz de 6 semanas que cubre el mes, comenzando en lunes.
function construirMes(anio, mes) {
  const primero = new Date(anio, mes, 1, 12);
  const offset = (primero.getDay() + 6) % 7; // lunes = 0
  const inicio = new Date(anio, mes, 1 - offset, 12);
  const semanas = [];
  for (let s = 0; s < 6; s++) {
    const semana = [];
    for (let d = 0; d < 7; d++) {
      const dia = new Date(inicio);
      dia.setDate(inicio.getDate() + s * 7 + d);
      semana.push({ iso: toISO(dia), delMes: dia.getMonth() === mes, numero: dia.getDate() });
    }
    semanas.push(semana);
  }
  return semanas;
}

/**
 * Calendario mensual con todas las fechas relevantes de convenios y
 * solicitudes. Cada evento se puede llevar a Google Calendar de a uno
 * (enlace directo) o exportar el mes completo como .ics.
 */
export default function CalendarioView({ convenios, solicitudes = [], onSelectConvenio }) {
  const hoy = hoyISO();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { anio: d.getFullYear(), mes: d.getMonth() };
  });
  const [tiposOcultos, setTiposOcultos] = useState([]);
  const [diaSeleccionado, setDiaSeleccionado] = useState(hoy);

  const integracion = estadoIntegracion();

  const todosLosEventos = useMemo(() => ([
    ...eventosDeConvenios(convenios),
    // Las solicitudes traen su vencimiento calculado en días hábiles (Art. 14).
    ...solicitudes.map(conVencimiento).flatMap(eventosDeSolicitud),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))), [convenios, solicitudes]);

  const eventos = useMemo(
    () => todosLosEventos.filter(e => !tiposOcultos.includes(e.tipo)),
    [todosLosEventos, tiposOcultos],
  );

  const porFecha = useMemo(() => agruparPorFecha(eventos), [eventos]);
  const semanas = useMemo(() => construirMes(cursor.anio, cursor.mes), [cursor]);

  const mover = (delta) => setCursor(prev => {
    const d = new Date(prev.anio, prev.mes + delta, 1, 12);
    return { anio: d.getFullYear(), mes: d.getMonth() };
  });

  const irAHoy = () => {
    const d = new Date();
    setCursor({ anio: d.getFullYear(), mes: d.getMonth() });
    setDiaSeleccionado(hoy);
  };

  const toggleTipo = (tipoId) => setTiposOcultos(prev =>
    prev.includes(tipoId) ? prev.filter(t => t !== tipoId) : [...prev, tipoId]);

  const prefijoMes = `${cursor.anio}-${String(cursor.mes + 1).padStart(2, '0')}`;
  const eventosDelMes = eventos.filter(e => e.fecha.startsWith(prefijoMes));
  const eventosDelDia = porFecha[diaSeleccionado] || [];

  const abrirReferencia = (ev) => {
    if (ev.refTipo !== 'convenio') return;
    const convenio = convenios.find(c => c.id === ev.refId);
    if (convenio) onSelectConvenio(convenio);
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Calendario</h2>
        <p>Fechas de ingreso, plazos, entregas a Rectoría y término de etapas</p>
      </div>

      <div className="calendario-toolbar">
        <div className="calendario-nav">
          <button className="btn btn-secondary btn-small" onClick={() => mover(-1)}>← Mes anterior</button>
          <span className="calendario-titulo">{nombreMes(cursor.mes)} {cursor.anio}</span>
          <button className="btn btn-secondary btn-small" onClick={() => mover(1)}>Mes siguiente →</button>
          <button className="btn btn-secondary btn-small" onClick={irAHoy}>Hoy</button>
        </div>
        <button
          className="btn btn-primary btn-small"
          onClick={() => descargarICS(eventosDelMes, `calendario-umag-${prefijoMes}.ics`)}
          disabled={eventosDelMes.length === 0}
        >
          📅 Exportar mes (.ics)
        </button>
      </div>

      <div className="calendario-leyenda">
        {Object.values(TIPOS_EVENTO).map(t => (
          <button
            key={t.id}
            className={`leyenda-chip ${tiposOcultos.includes(t.id) ? 'apagado' : ''}`}
            style={{ borderColor: t.color }}
            onClick={() => toggleTipo(t.id)}
            title="Mostrar u ocultar este tipo de evento"
          >
            <span aria-hidden="true">{t.icono}</span> {t.label}
          </button>
        ))}
      </div>

      <div className="calendario-grid">
        {DIAS_SEMANA.map(d => <div key={d} className="calendario-encabezado">{d}</div>)}
        {semanas.flat().map(dia => {
          const delDia = porFecha[dia.iso] || [];
          return (
            <div
              key={dia.iso}
              className={[
                'calendario-celda',
                dia.delMes ? '' : 'fuera-mes',
                dia.iso === hoy ? 'hoy' : '',
                dia.iso === diaSeleccionado ? 'seleccionado' : '',
                esFeriado(dia.iso) ? 'feriado' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => setDiaSeleccionado(dia.iso)}
            >
              <div className="calendario-numero">{dia.numero}</div>
              {delDia.slice(0, 3).map(ev => (
                <div key={ev.uid} className="calendario-evento" style={{ borderLeftColor: ev.color }} title={ev.titulo}>
                  <span aria-hidden="true">{ev.icono}</span> {ev.titulo}
                </div>
              ))}
              {delDia.length > 3 && <div className="calendario-mas">+{delDia.length - 3} más</div>}
            </div>
          );
        })}
      </div>

      <div className="detail-sections" style={{ marginTop: '1.5rem' }}>
        <div className="section">
          <h3 className="section-title">Eventos del {formatFecha(diaSeleccionado)}</h3>
          {eventosDelDia.length === 0 ? (
            <p className="historial-vacio">Sin eventos ese día.</p>
          ) : (
            <div className="lista-compacta">
              {eventosDelDia.map(ev => (
                <div key={ev.uid} className="lista-compacta-item">
                  <span aria-hidden="true">{ev.icono}</span>
                  <div className="lista-compacta-texto" onClick={() => abrirReferencia(ev)}>
                    <div className="lista-compacta-titulo">{ev.titulo}</div>
                    <div className="lista-compacta-meta">{ev.tipoLabel}{ev.descripcion ? ` · ${ev.descripcion}` : ''}</div>
                  </div>
                  <a className="btn btn-secondary btn-small" href={urlGoogleCalendar(ev)} target="_blank" rel="noopener noreferrer">
                    Agregar a Google
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="section">
          <h3 className="section-title">Integración con Google Calendar</h3>
          <ul className="lista-estado">
            <li>✅ Exportación .ics de convenios y solicitudes (importable en Google Calendar).</li>
            <li>✅ Enlace directo &quot;Agregar a Google Calendar&quot; por evento.</li>
            <li>{integracion.configurado ? '🟡' : '⬜'} Sincronización automática: pendiente.</li>
          </ul>
          <p className="nota-seccion">{integracion.detalle}</p>
          <p className="nota-seccion">
            Para habilitar la sincronización automática hay que definir
            <code> VITE_GOOGLE_CLIENT_ID</code> y <code>VITE_GOOGLE_CALENDAR_ID</code> e
            implementar el adaptador descrito en <code>src/utils/googleCalendar.js</code>.
            Los eventos ya llevan un identificador estable, de modo que la sincronización
            podrá actualizarlos sin duplicarlos.
          </p>
        </div>
      </div>
    </div>
  );
}

CalendarioView.propTypes = {
  convenios: PropTypes.array.isRequired,
  solicitudes: PropTypes.array,
  onSelectConvenio: PropTypes.func.isRequired,
};
