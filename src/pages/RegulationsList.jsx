import React, { useState } from 'react';

function RegulationsList({ regulations, onSelectRegulation, onUpdateRegulation }) {
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("");
  const [filterPrioridad, setFilterPrioridad] = useState("");
  const [filterResponsable, setFilterResponsable] = useState("");
  const [viewMode, setViewMode] = useState("table");

  const responsables = [...new Set(regulations.map(r => r.responsable).filter(Boolean))].sort();

  const filtered = regulations.filter(r => {
    const matchSearch = !search || (r.nombre && r.nombre.toLowerCase().includes(search.toLowerCase())) || (r.numero && String(r.numero).includes(search)) || (r.responsable && r.responsable.toLowerCase().includes(search.toLowerCase()));
    const matchEstado = !filterEstado || r.estado === filterEstado;
    const matchPrioridad = !filterPrioridad || r.prioridad === filterPrioridad;
    const matchResponsable = !filterResponsable || r.responsable === filterResponsable;
    return matchSearch && matchEstado && matchPrioridad && matchResponsable;
  });

  const activeFilters = [];
  if (filterEstado) activeFilters.push({ label: filterEstado, clear: () => setFilterEstado("") });
  if (filterPrioridad) activeFilters.push({ label: filterPrioridad, clear: () => setFilterPrioridad("") });
  if (filterResponsable) activeFilters.push({ label: filterResponsable, clear: () => setFilterResponsable("") });

  const STATES = ["Pendiente", "En Proceso", "En Revisión", "Aprobado"];

  const handleKanbanMove = (reg, newEstado) => {
    const newProgreso = newEstado === "Aprobado" ? 100 : newEstado === "Pendiente" ? 0 : reg.progreso;
    onUpdateRegulation({ ...reg, estado: newEstado, progreso: newProgreso });
  };

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Reglamentos</h2>
          <p>Gestionar todos los reglamentos de la universidad</p>
        </div>
        <div className="view-toggle">
          <button className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')}>📋 Tabla</button>
          <button className={`view-toggle-btn ${viewMode === 'kanban' ? 'active' : ''}`} onClick={() => setViewMode('kanban')}>📊 Kanban</button>
        </div>
      </div>

      <div className="filters-bar">
        <input type="text" className="search-input" placeholder="Buscar por nombre, número o responsable..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="filter-select" value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {STATES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="filter-select" value={filterPrioridad} onChange={(e) => setFilterPrioridad(e.target.value)}>
          <option value="">Toda prioridad</option>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </select>
        <select className="filter-select" value={filterResponsable} onChange={(e) => setFilterResponsable(e.target.value)}>
          <option value="">Todos los responsables</option>
          {responsables.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {activeFilters.length > 0 && (
        <div className="active-filters" style={{ marginBottom: '1rem' }}>
          {activeFilters.map(f => (
            <span key={f.label} className="filter-tag" onClick={f.clear}>{f.label} ✕</span>
          ))}
          <span className="filter-tag" onClick={() => { setFilterEstado(""); setFilterPrioridad(""); setFilterResponsable(""); }} style={{ background: '#fee2e2', borderColor: '#fecaca', color: '#dc2626' }}>Limpiar todo ✕</span>
        </div>
      )}

      <div className="results-count">{filtered.length} de {regulations.length} reglamentos</div>

      {viewMode === 'table' ? (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>N°</th>
                <th>Nombre</th>
                <th>Artículo Estatuto</th>
                <th>Estado</th>
                <th>Progreso</th>
                <th>Responsable</th>
                <th>Decreto</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td>{r.numero || '-'}</td>
                  <td>{r.nombre}</td>
                  <td>{r.articulo_estatuto || r.articulo || '-'}</td>
                  <td><span className={`badge ${(r.estado || 'pendiente').toLowerCase().replace(/\s+/g, '-')}`}>{r.estado}</span></td>
                  <td>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${r.progreso}%` }}></div>
                    </div>
                  </td>
                  <td>{r.responsable || '-'}</td>
                  <td style={{ fontSize: '0.75rem' }}>{r.decreto ? (r.enlace ? <a href={r.enlace} target="_blank" rel="noopener noreferrer" style={{ color: '#1a56db' }}>{r.decreto}</a> : r.decreto) : '-'}</td>
                  <td>
                    <button className="btn btn-primary btn-small" onClick={() => onSelectRegulation(r)}>Ver</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No se encontraron reglamentos con esos filtros</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="kanban-board">
          {STATES.map(estado => {
            const columnRegs = filtered.filter(r => r.estado === estado);
            const stateIdx = STATES.indexOf(estado);
            return (
              <div key={estado} className="kanban-column">
                <div className={`kanban-column-header ${estado.toLowerCase().replace(/\s+/g, '-')}`}>
                  <span className="kanban-column-title">{estado}</span>
                  <span className="kanban-column-count">{columnRegs.length}</span>
                </div>
                {columnRegs.map(r => (
                  <div key={r.id} className={`kanban-card ${r.prioridad}`} onClick={() => onSelectRegulation(r)} title={r.observaciones || ''}>
                    <div className="kanban-card-title">{r.numero ? `${r.numero}. ` : ''}{r.nombre}</div>
                    {r.observaciones && <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.375rem', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{r.observaciones}</div>}
                    <div className="kanban-card-meta">
                      <span>{r.responsable || '-'}</span>
                      <div className="kanban-card-progress">
                        <div className="progress-bar" style={{ width: 50 }}>
                          <div className="progress-fill" style={{ width: `${r.progreso}%` }}></div>
                        </div>
                        <span>{r.progreso}%</span>
                      </div>
                    </div>
                    <div className="kanban-move-btns" onClick={(e) => e.stopPropagation()}>
                      {stateIdx > 0 && <button className="kanban-move-btn" onClick={() => handleKanbanMove(r, STATES[stateIdx - 1])}>← {STATES[stateIdx - 1]}</button>}
                      {stateIdx < STATES.length - 1 && <button className="kanban-move-btn" onClick={() => handleKanbanMove(r, STATES[stateIdx + 1])}>{STATES[stateIdx + 1]} →</button>}
                    </div>
                  </div>
                ))}
                {columnRegs.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.8rem' }}>Sin reglamentos</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default RegulationsList;
