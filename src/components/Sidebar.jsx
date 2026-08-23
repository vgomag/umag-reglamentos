import React from 'react';
import PropTypes from 'prop-types';

const icono = (paths) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{paths}</svg>
);

// La navegación está agrupada por módulo. El grupo "Reglamentos" conserva
// intactas las vistas originales del sistema de seguimiento normativo.
export const NAV_GRUPOS = [
  {
    id: 'convenios',
    titulo: 'Transparencia y Convenios',
    items: [
      { id: 'conv-dashboard', label: 'Dashboard', icon: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></> },
      { id: 'convenios', label: 'Convenios', icon: <><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></> },
      { id: 'seguimiento', label: 'Seguimiento', icon: <><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></> },
      { id: 'calendario', label: 'Calendario', icon: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></> },
      { id: 'transparencia', label: 'Transparencia', icon: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></> },
      { id: 'reportes', label: 'Reportes', icon: <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></> },
      { id: 'configuracion', label: 'Configuración', icon: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></> },
    ],
  },
  {
    id: 'reglamentos',
    titulo: 'Reglamentos',
    items: [
      { id: 'resumen', label: 'Resumen Ejecutivo', icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></> },
      { id: 'dashboard', label: 'Dashboard', icon: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></> },
      { id: 'regulations', label: 'Reglamentos', icon: <><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></> },
      { id: 'plazos', label: 'Plazos', icon: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></> },
      { id: 'gantt', label: 'Carta Gantt', icon: <><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="16" y2="12"/><line x1="4" y1="18" x2="12" y2="18"/></> },
      { id: 'documentos', label: 'Documentos', icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></> },
      { id: 'normativa', label: 'Normativa', icon: <><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></> },
      { id: 'new', label: 'Nuevo Reglamento', icon: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></> },
    ],
  },
];

function Sidebar({ activeView, onViewChange, sidebarOpen }) {
  return (
    <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      {NAV_GRUPOS.map(grupo => (
        <div key={grupo.id} className="sidebar-grupo">
          <div className="sidebar-header">{grupo.titulo}</div>
          {grupo.items.map(item => (
            <div
              key={item.id}
              className={`nav-item ${activeView === item.id ? 'active' : ''}`}
              onClick={() => onViewChange(item.id)}
            >
              <span className="nav-icon">{icono(item.icon)}</span>
              {item.label}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

Sidebar.propTypes = {
  activeView: PropTypes.string.isRequired,
  onViewChange: PropTypes.func.isRequired,
  sidebarOpen: PropTypes.bool.isRequired,
};

export default Sidebar;
