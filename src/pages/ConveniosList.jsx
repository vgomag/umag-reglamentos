import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { ESTADOS_CONVENIO, PRIORIDADES, UNIDADES } from '../config/convenios';
import {
  filtrarConvenios, ordenarConvenios, FILTROS_VACIOS, ORDENES,
  etiquetaUbicacion, progresoConvenio, textoPlazo, infoPlazo, hayFiltrosActivos,
} from '../utils/conveniosLogic';
import { formatFecha } from '../utils/fechas';
import PlazoBadge from '../components/PlazoBadge';

const claseEstado = (estado) => (estado || 'ingresado').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');

/**
 * Listado de convenios. Por defecto se ordena por fecha de ingreso ascendente,
 * porque el criterio habitual de trabajo es el orden de llegada (regla N°1).
 */
export default function ConveniosList({ convenios, filtrosIniciales, onSelectConvenio, onNuevo }) {
  const [filtros, setFiltros] = useState({ ...FILTROS_VACIOS, ...filtrosIniciales });
  const [orden, setOrden] = useState('llegada');
  const [filtrosAvanzados, setFiltrosAvanzados] = useState(false);

  // Las tarjetas del dashboard navegan hacia acá con un filtro ya aplicado.
  useEffect(() => {
    if (filtrosIniciales && Object.keys(filtrosIniciales).length > 0) {
      setFiltros({ ...FILTROS_VACIOS, ...filtrosIniciales });
      setFiltrosAvanzados(true);
    }
  }, [filtrosIniciales]);

  const set = (campo) => (e) => {
    const valor = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFiltros(prev => ({ ...prev, [campo]: valor }));
  };

  const unidadesOrigen = useMemo(
    () => [...new Set(convenios.map(c => c.unidadOrigen).filter(Boolean))].sort(),
    [convenios],
  );

  const visibles = useMemo(
    () => ordenarConvenios(filtrarConvenios(convenios, filtros), orden),
    [convenios, filtros, orden],
  );

  const limpiar = () => setFiltros({ ...FILTROS_VACIOS });

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Convenios</h2>
          <p>Registro y seguimiento de convenios institucionales</p>
        </div>
        <button className="btn btn-primary" onClick={onNuevo}>+ Nuevo convenio</button>
      </div>

      <div className="filters-bar">
        <input
          type="text" className="search-input"
          placeholder="Buscar por nombre, código, unidad, contraparte..."
          value={filtros.busqueda} onChange={set('busqueda')}
        />
        <select className="filter-select" value={filtros.estado} onChange={set('estado')}>
          <option value="">Todos los estados</option>
          {ESTADOS_CONVENIO.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select className="filter-select" value={filtros.unidadOrigen} onChange={set('unidadOrigen')}>
          <option value="">Toda unidad de origen</option>
          {unidadesOrigen.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <select className="filter-select" value={filtros.unidadActual} onChange={set('unidadActual')}>
          <option value="">En cualquier unidad</option>
          <option value="INGRESADO">Ingresado (sin derivar)</option>
          {UNIDADES.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
        </select>
        <select className="filter-select" value={filtros.plazo} onChange={set('plazo')}>
          <option value="">Cualquier plazo</option>
          <option value="con-plazo">Con plazo especial</option>
          <option value="sin-plazo">Sin plazo especial</option>
          <option value="por-vencer">🟡 Próximos a vencer</option>
          <option value="vencido">🔴 Plazo vencido</option>
        </select>
        <select className="filter-select" value={filtros.situacion} onChange={set('situacion')}>
          <option value="">Todas las situaciones</option>
          <option value="pendientes">Pendientes</option>
          <option value="en-tramite">En trámite</option>
          <option value="rectoria">Pendientes de Rectoría</option>
          <option value="finalizados">Finalizados</option>
        </select>
        <select className="filter-select" value={orden} onChange={(e) => setOrden(e.target.value)}>
          {ORDENES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <button className="btn btn-secondary btn-small" onClick={() => setFiltrosAvanzados(v => !v)}>
          {filtrosAvanzados ? 'Ocultar fechas' : 'Filtrar por fechas'}
        </button>
      </div>

      {filtrosAvanzados && (
        <div className="filters-bar filtros-fechas">
          <label className="filtro-fecha">
            <span>Ingreso desde</span>
            <input type="date" value={filtros.ingresoDesde} onChange={set('ingresoDesde')} />
          </label>
          <label className="filtro-fecha">
            <span>Ingreso hasta</span>
            <input type="date" value={filtros.ingresoHasta} onChange={set('ingresoHasta')} />
          </label>
          <label className="filtro-fecha">
            <span>Entrega a Rectoría desde</span>
            <input type="date" value={filtros.entregaDesde} onChange={set('entregaDesde')} />
          </label>
          <label className="filtro-fecha">
            <span>Entrega a Rectoría hasta</span>
            <input type="date" value={filtros.entregaHasta} onChange={set('entregaHasta')} />
          </label>
          <select className="filter-select" value={filtros.prioridad} onChange={set('prioridad')}>
            <option value="">Toda prioridad</option>
            {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      )}

      {hayFiltrosActivos(filtros) && (
        <div className="active-filters" style={{ marginBottom: '1rem' }}>
          <span className="filter-tag" onClick={limpiar} style={{ background: '#fee2e2', borderColor: '#fecaca', color: '#dc2626' }}>
            Limpiar filtros ✕
          </span>
        </div>
      )}

      <div className="results-count">{visibles.length} de {convenios.length} convenios</div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Plazo</th>
              <th>Convenio</th>
              <th>Unidad origen</th>
              <th>Ingreso</th>
              <th>Ubicación actual</th>
              <th>Avance</th>
              <th>Entrega Rectoría</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(c => {
              const plazo = infoPlazo(c);
              return (
                <tr key={c.id} className={`fila-${plazo.key}`}>
                  <td title={textoPlazo(c)}><PlazoBadge convenio={c} compacto /></td>
                  <td>
                    <div className="celda-titulo">{c.nombre}</div>
                    <div className="celda-sub">
                      {c.codigo ? `${c.codigo} · ` : ''}{c.tipo || 'Sin tipo'}
                      {c.prioridad !== 'normal' && <span className={`badge ${c.prioridad === 'urgente' ? 'alta' : 'media'}`} style={{ marginLeft: '0.4rem' }}>{c.prioridad}</span>}
                    </div>
                  </td>
                  <td>{c.unidadOrigen || '—'}</td>
                  <td>{formatFecha(c.fechaIngreso)}</td>
                  <td><span className="badge en-proceso">{etiquetaUbicacion(c)}</span></td>
                  <td>
                    <div className="progress-bar"><div className="progress-fill" style={{ width: `${progresoConvenio(c)}%` }}></div></div>
                    <div className="progress-text">{progresoConvenio(c)}%</div>
                  </td>
                  <td>{formatFecha(c.fechaEntregaRectoria)}</td>
                  <td><span className={`badge ${claseEstado(c.estado)}`}>{c.estado}</span></td>
                  <td><button className="btn btn-primary btn-small" onClick={() => onSelectConvenio(c)}>Ver</button></td>
                </tr>
              );
            })}
            {visibles.length === 0 && (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                  {convenios.length === 0
                    ? 'Aún no hay convenios registrados. Usa "+ Nuevo convenio" para ingresar el primero.'
                    : 'Ningún convenio coincide con esos filtros.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

ConveniosList.propTypes = {
  convenios: PropTypes.array.isRequired,
  filtrosIniciales: PropTypes.object,
  onSelectConvenio: PropTypes.func.isRequired,
  onNuevo: PropTypes.func.isRequired,
};
