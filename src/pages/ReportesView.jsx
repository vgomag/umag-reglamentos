import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { UNIDADES, ESTADOS_CONVENIO, SEMAFORO } from '../config/convenios';
import {
  resumenConvenios, pendientesPorUnidad, conteoPorCampo, tiempoPromedioTramitacion,
  estadoPlazo, etiquetaUbicacion, progresoConvenio, etapasActivas,
} from '../utils/conveniosLogic';
import { resumenSolicitudes } from '../utils/transparenciaLogic';
import { formatFecha, duracionDias, hoyISO } from '../utils/fechas';
import { generarCSV } from '../utils/csv';

function descargar(nombre, contenido, mime) {
  const blob = new Blob([contenido], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nombre;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Reportes agregados y exportación de datos. */
export default function ReportesView({ convenios, solicitudes = [] }) {
  const stats = resumenConvenios(convenios);
  const statsSAI = resumenSolicitudes(solicitudes);
  const porUnidad = pendientesPorUnidad(convenios);
  const porOrigen = conteoPorCampo(convenios, 'unidadOrigen');
  const porTipo = conteoPorCampo(convenios, 'tipo');
  const promedio = tiempoPromedioTramitacion(convenios);

  const porEstado = useMemo(
    () => ESTADOS_CONVENIO.map(e => ({ estado: e, total: convenios.filter(c => c.estado === e).length })),
    [convenios],
  );

  const porSemaforo = useMemo(
    () => Object.entries(SEMAFORO).map(([key, s]) => ({
      key, ...s, total: convenios.filter(c => estadoPlazo(c) === key).length,
    })),
    [convenios],
  );

  // Duración promedio de revisión por unidad, sobre etapas ya cerradas.
  const duracionPorUnidad = useMemo(() => UNIDADES.map(u => {
    const duraciones = convenios
      .flatMap(c => (c.etapas || []).filter(e => e.unidad === u.id))
      .map(e => duracionDias(e.fechaInicio, e.fechaTermino))
      .filter(d => d !== null && d >= 0);
    return {
      unidad: u.nombre,
      muestras: duraciones.length,
      promedio: duraciones.length ? Math.round(duraciones.reduce((s, d) => s + d, 0) / duraciones.length) : null,
    };
  }), [convenios]);

  const exportarCSV = () => {
    const encabezados = ['ID', 'Código', 'Nombre', 'Unidad origen', 'Contraparte', 'Tipo',
      'Fecha ingreso', 'Fecha límite', 'Entrega Rectoría', 'Estado', 'Prioridad',
      'Ubicación actual', 'Avance %', 'Semáforo', 'Etapas activas', 'Observaciones'];
    const filas = convenios.map(c => [
      c.id, c.codigo, c.nombre, c.unidadOrigen, c.contraparte, c.tipo,
      c.fechaIngreso, c.fechaLimite, c.fechaEntregaRectoria, c.estado, c.prioridad,
      etiquetaUbicacion(c), progresoConvenio(c), SEMAFORO[estadoPlazo(c)]?.label || '',
      etapasActivas(c).length, (c.observaciones || '').replace(/\s+/g, ' '),
    ]);
    descargar(`convenios_${hoyISO()}.csv`, generarCSV(encabezados, filas), 'text/csv');
  };

  const exportarJSON = () => {
    descargar(`convenios_${hoyISO()}.json`, JSON.stringify(convenios, null, 2), 'application/json');
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Reportes</h2>
        <p>Visión agregada de la gestión de convenios y transparencia</p>
      </div>

      <div className="dashboard-grid">
        <div className="metric-card"><div className="metric-value">{stats.total}</div><div className="metric-label">Convenios registrados</div></div>
        <div className="metric-card success"><div className="metric-value">{stats.finalizados}</div><div className="metric-label">Finalizados</div></div>
        <div className="metric-card warning"><div className="metric-value">{stats.pendientes}</div><div className="metric-label">Pendientes</div></div>
        <div className="metric-card"><div className="metric-value">{promedio !== null ? `${promedio} d` : '—'}</div><div className="metric-label">Tramitación promedio</div></div>
        <div className="metric-card"><div className="metric-value">{statsSAI.total}</div><div className="metric-label">Solicitudes Ley 20.285</div></div>
        <div className="metric-card danger"><div className="metric-value">{statsSAI.vencidas}</div><div className="metric-label">Solicitudes vencidas</div></div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-card-title">Convenios por estado</div>
          <div className="bar-chart">
            {porEstado.map(e => (
              <div key={e.estado} className="bar-row">
                <div className="bar-label" style={{ width: 130 }}>{e.estado}</div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${stats.total ? Math.max((e.total / stats.total) * 100, 6) : 6}%` }}>
                    <span>{e.total}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-title">Distribución por semáforo de plazos</div>
          <div className="bar-chart">
            {porSemaforo.map(s => (
              <div key={s.key} className="bar-row">
                <div className="bar-label" style={{ width: 130 }}>{s.icono} {s.label}</div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${stats.total ? Math.max((s.total / stats.total) * 100, 6) : 6}%`, background: s.color }}>
                    <span>{s.total}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-title">Carga actual por unidad</div>
          <div className="bar-chart">
            {UNIDADES.map(u => (
              <div key={u.id} className="bar-row">
                <div className="bar-label">{u.nombre}</div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${stats.pendientes ? Math.max(((porUnidad[u.id] || 0) / stats.pendientes) * 100, 6) : 6}%`, background: u.color }}>
                    <span>{porUnidad[u.id] || 0}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-title">Días promedio de revisión por unidad</div>
          <div className="table-container">
            <table>
              <thead><tr><th>Unidad</th><th>Etapas cerradas</th><th>Promedio</th></tr></thead>
              <tbody>
                {duracionPorUnidad.map(d => (
                  <tr key={d.unidad}>
                    <td>{d.unidad}</td>
                    <td>{d.muestras}</td>
                    <td>{d.promedio !== null ? `${d.promedio} días` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="detail-sections">
        <div className="section">
          <h3 className="section-title">Convenios por unidad de origen</h3>
          {porOrigen.length === 0 ? <p className="historial-vacio">Sin datos.</p> : (
            <table className="tabla-plazos">
              <tbody>
                {porOrigen.map(([nombre, total]) => (
                  <tr key={nombre}><th>{nombre}</th><td>{total}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="section">
          <h3 className="section-title">Convenios por tipo</h3>
          {porTipo.length === 0 ? <p className="historial-vacio">Sin datos.</p> : (
            <table className="tabla-plazos">
              <tbody>
                {porTipo.map(([nombre, total]) => (
                  <tr key={nombre}><th>{nombre}</th><td>{total}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">Exportar</h3>
        <div className="btn-group">
          <button className="btn btn-secondary" onClick={exportarCSV} disabled={convenios.length === 0}>📊 Convenios en CSV</button>
          <button className="btn btn-secondary" onClick={exportarJSON} disabled={convenios.length === 0}>📥 Convenios en JSON</button>
        </div>
        <p className="nota-seccion">
          El CSV usa punto y coma como separador y BOM UTF-8, que es lo que Excel en
          español espera. Datos al {formatFecha(hoyISO())}.
        </p>
      </div>
    </div>
  );
}

ReportesView.propTypes = {
  convenios: PropTypes.array.isRequired,
  solicitudes: PropTypes.array,
};
