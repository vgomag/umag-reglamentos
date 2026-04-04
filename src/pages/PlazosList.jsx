import React from 'react';
import { PLAZOS_DATA } from '../config/data';

function PlazosList() {
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
              <th>Formalidad</th>
              <th>Requisito</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {PLAZOS_DATA.map(p => (
              <tr key={p.id}>
                <td>{p.gestion}</td>
                <td>{p.plazo}</td>
                <td>{p.objeto}</td>
                <td>{p.formalidad}</td>
                <td>{p.requisito}</td>
                <td>
                  <button className="btn btn-primary btn-small" onClick={() => alert('Función de Google Calendar aquí')}>
                    📅 Agregar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PlazosList;
