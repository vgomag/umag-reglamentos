import React from 'react';
import { PLAZOS_DATA } from '../config/data';

function PlazosList({ regulations = [] }) {
  // Buscar el estado real de un reglamento por nombre parcial
  const getRegStatus = (objeto) => {
    if (!objeto || !regulations.length) return null;
    const lower = objeto.toLowerCase();
    return regulations.find(r =>
      r.nombre && lower.includes(r.nombre.toLowerCase().substring(0, 20))
    );
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Plazos de Tramitación</h2>
        <p>Cronograma de plazos para la aprobación de reglamentos</p>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Gestión</th>
              <th>Plazo</th>
              <th>Objeto</th>
              <th>Estado Actual</th>
              <th>Formalidad</th>
              <th>Requisito</th>
            </tr>
          </thead>
          <tbody>
            {(PLAZOS_DATA || []).map(p => {
              const reg = getRegStatus(p.objeto);
              return (
                <tr key={p.id}>
                  <td>{p.gestion}</td>
                  <td>{p.plazo}</td>
                  <td>{p.objeto}</td>
                  <td>
                    {reg ? (
                      <span className={`badge ${(reg.estado || 'pendiente').toLowerCase().replace(/\s+/g, '-')}`}>
                        {reg.estado} ({reg.progreso}%)
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>—</span>
                    )}
                  </td>
                  <td>{p.formalidad}</td>
                  <td>{p.requisito}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PlazosList;
