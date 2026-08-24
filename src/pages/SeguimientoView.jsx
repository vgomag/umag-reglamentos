import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { UNIDADES } from '../config/convenios';
import {
  ubicacionActual, estaCerrado, ordenarConvenios, etapaActual,
  infoPlazo, textoPlazo, progresoConvenio,
} from '../utils/conveniosLogic';
import { formatFecha, diasHasta } from '../utils/fechas';
import PlazoBadge from '../components/PlazoBadge';

// Columnas del tablero: ingreso + cada unidad + finalizados.
const COLUMNAS = [
  { id: 'INGRESADO', nombre: 'Ingresado', descripcion: 'Recibidos, aún sin derivar', color: '#64748b' },
  ...UNIDADES,
  { id: 'FINALIZADO', nombre: 'Finalizado', descripcion: 'Tramitación cerrada', color: '#10b981' },
];

/**
 * Tablero de seguimiento: muestra en qué unidad está cada convenio ahora.
 * Complementa al listado — aquí lo que importa es la ubicación, no la fecha.
 */
export default function SeguimientoView({ convenios, onSelectConvenio }) {
  const [soloPendientes, setSoloPendientes] = useState(true);

  const porColumna = useMemo(() => {
    const mapa = {};
    COLUMNAS.forEach(c => { mapa[c.id] = []; });
    convenios.forEach(c => {
      // Los cerrados van todos a la columna Finalizado, que se oculta al
      // marcar "Ocultar finalizados": no hace falta filtrarlos aparte.
      if (soloPendientes && estaCerrado(c)) return;
      const ubic = ubicacionActual(c);
      if (mapa[ubic]) mapa[ubic].push(c);
    });
    Object.keys(mapa).forEach(k => { mapa[k] = ordenarConvenios(mapa[k], 'urgencia'); });
    return mapa;
  }, [convenios, soloPendientes]);

  // Días que el convenio lleva detenido en la unidad donde está ahora.
  const diasEnUnidad = (convenio) => {
    const etapa = etapaActual(convenio);
    if (!etapa || !etapa.fechaInicio) return null;
    const dias = diasHasta(etapa.fechaInicio);
    return dias === null ? null : Math.abs(dias);
  };

  const columnasVisibles = soloPendientes ? COLUMNAS.filter(c => c.id !== 'FINALIZADO') : COLUMNAS;

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Seguimiento</h2>
          <p>Dónde está cada convenio en este momento</p>
        </div>
        <label className="checkbox-label">
          <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} />
          Ocultar finalizados
        </label>
      </div>

      <div className="kanban-board seguimiento-board">
        {columnasVisibles.map(col => {
          const items = porColumna[col.id] || [];
          return (
            <div key={col.id} className="kanban-column">
              <div className="kanban-column-header" style={{ borderTopColor: col.color }} title={col.descripcion}>
                <span className="kanban-column-title">{col.nombre}</span>
                <span className="kanban-column-count">{items.length}</span>
              </div>
              {items.map(c => {
                const dias = diasEnUnidad(c);
                const plazo = infoPlazo(c);
                return (
                  <div
                    key={c.id}
                    className={`kanban-card seguimiento-card ${plazo.key}`}
                    onClick={() => onSelectConvenio(c)}
                    title={c.observaciones || c.nombre}
                  >
                    <div className="kanban-card-title">{c.nombre}</div>
                    <div className="seguimiento-card-meta">
                      <PlazoBadge convenio={c} compacto />
                      <span>{c.unidadOrigen || 'Sin unidad'}</span>
                    </div>
                    <div className="kanban-card-meta">
                      <span>Ingresó {formatFecha(c.fechaIngreso)}</span>
                      <span>{progresoConvenio(c)}%</span>
                    </div>
                    {dias !== null && col.id !== 'FINALIZADO' && (
                      <div className={`seguimiento-dias ${dias > 15 ? 'alerta' : ''}`}>
                        {dias} día(s) en esta unidad
                      </div>
                    )}
                    {plazo.key !== 'sin-plazo' && plazo.key !== 'finalizado' && (
                      <div className="seguimiento-dias">{textoPlazo(c)}</div>
                    )}
                  </div>
                );
              })}
              {items.length === 0 && (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                  Sin convenios
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

SeguimientoView.propTypes = {
  convenios: PropTypes.array.isRequired,
  onSelectConvenio: PropTypes.func.isRequired,
};
