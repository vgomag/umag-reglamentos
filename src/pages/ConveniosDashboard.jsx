import React from 'react';
import PropTypes from 'prop-types';
import { UNIDADES, SEMAFORO } from '../config/convenios';
import {
  resumenConvenios, pendientesPorUnidad, ordenarConvenios, filtrarConvenios,
  infoPlazo, etiquetaUbicacion, textoPlazo,
} from '../utils/conveniosLogic';
import { formatFecha } from '../utils/fechas';
import PlazoBadge from '../components/PlazoBadge';

/** Panel principal: estado general de los convenios de un vistazo. */
export default function ConveniosDashboard({ convenios, onSelectConvenio, onIrA }) {
  const stats = resumenConvenios(convenios);
  const porUnidad = pendientesPorUnidad(convenios);

  // Los que exigen atención hoy: vencidos primero, luego próximos a vencer.
  const criticos = ordenarConvenios(
    convenios.filter(c => ['vencido', 'por-vencer'].includes(infoPlazo(c).key)),
    'urgencia',
  );

  // Cola de trabajo por orden de llegada (regla de negocio N°1).
  const cola = ordenarConvenios(
    filtrarConvenios(convenios, { situacion: 'pendientes' }),
    'llegada',
  ).slice(0, 8);

  const tarjetas = [
    { label: 'Total de convenios', valor: stats.total, clase: '', vista: { situacion: '' } },
    { label: 'Ingresados (últimos 30 días)', valor: stats.recientes, clase: '', vista: null },
    { label: 'En trámite', valor: stats.enTramite, clase: 'warning', vista: { situacion: 'en-tramite' } },
    { label: 'Pendientes de Rectoría', valor: stats.rectoria, clase: 'warning', vista: { situacion: 'rectoria' } },
    { label: 'Finalizados', valor: stats.finalizados, clase: 'success', vista: { situacion: 'finalizados' } },
    { label: 'Con plazo especial', valor: stats.conPlazo, clase: '', vista: { plazo: 'con-plazo' } },
    { label: 'Próximos a vencer', valor: stats.porVencer, clase: 'warning', vista: { plazo: 'por-vencer' } },
    { label: 'Con plazo vencido', valor: stats.vencidos, clase: 'danger', vista: { plazo: 'vencido' } },
  ];

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Panel de Convenios</h2>
        <p>Estado general de la tramitación de convenios institucionales</p>
      </div>

      <div className="dashboard-grid">
        {tarjetas.map(t => (
          <div
            key={t.label}
            className={`metric-card ${t.clase} ${t.vista ? 'clickable' : ''}`}
            onClick={t.vista ? () => onIrA('convenios', t.vista) : undefined}
            title={t.vista ? 'Ver en el listado' : undefined}
          >
            <div className="metric-value">{t.valor}</div>
            <div className="metric-label">{t.label}</div>
          </div>
        ))}
      </div>

      <div className="section" style={{ marginBottom: '1.5rem' }}>
        <h3 className="section-title">Convenios pendientes por unidad</h3>
        <div className="unidades-grid">
          <div className="unidad-card" onClick={() => onIrA('convenios', { unidadActual: 'INGRESADO' })}>
            <div className="unidad-card-nombre">Ingresado</div>
            <div className="unidad-card-valor">{porUnidad.INGRESADO || 0}</div>
            <div className="unidad-card-desc">Aún sin derivar</div>
          </div>
          {UNIDADES.map(u => (
            <div
              key={u.id}
              className="unidad-card"
              style={{ borderTopColor: u.color }}
              onClick={() => onIrA('convenios', { unidadActual: u.id })}
              title={u.descripcion}
            >
              <div className="unidad-card-nombre">{u.nombre}</div>
              <div className="unidad-card-valor">{porUnidad[u.id] || 0}</div>
              <div className="unidad-card-desc">{u.descripcion}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-card-title">⚠️ Requieren atención inmediata</div>
          {criticos.length === 0 ? (
            <p className="historial-vacio">Ningún convenio con plazo vencido o próximo a vencer.</p>
          ) : (
            <div className="lista-compacta">
              {criticos.slice(0, 8).map(c => (
                <div key={c.id} className="lista-compacta-item" onClick={() => onSelectConvenio(c)}>
                  <PlazoBadge convenio={c} compacto />
                  <div className="lista-compacta-texto">
                    <div className="lista-compacta-titulo">{c.nombre}</div>
                    <div className="lista-compacta-meta">
                      {etiquetaUbicacion(c)} · límite {formatFecha(c.fechaLimite)} · {textoPlazo(c)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="chart-card">
          <div className="chart-card-title">📥 Cola por orden de llegada</div>
          {cola.length === 0 ? (
            <p className="historial-vacio">No hay convenios pendientes.</p>
          ) : (
            <div className="lista-compacta">
              {cola.map(c => (
                <div key={c.id} className="lista-compacta-item" onClick={() => onSelectConvenio(c)}>
                  <PlazoBadge convenio={c} compacto />
                  <div className="lista-compacta-texto">
                    <div className="lista-compacta-titulo">{c.nombre}</div>
                    <div className="lista-compacta-meta">
                      Ingresó {formatFecha(c.fechaIngreso)} · {c.unidadOrigen || 'sin unidad'} · en {etiquetaUbicacion(c)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">Leyenda de plazos</h3>
        <div className="leyenda-plazos">
          {Object.entries(SEMAFORO).map(([key, s]) => (
            <span key={key} className={`plazo-badge ${s.clase}`}>
              <span className="plazo-badge-icono" aria-hidden="true">{s.icono}</span>{s.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

ConveniosDashboard.propTypes = {
  convenios: PropTypes.array.isRequired,
  onSelectConvenio: PropTypes.func.isRequired,
  onIrA: PropTypes.func.isRequired,
};
