import React from 'react';
import PropTypes from 'prop-types';
import { TIPOS_HISTORIAL } from '../config/convenios';

const ICONOS = {
  [TIPOS_HISTORIAL.CREACION]: '📥',
  [TIPOS_HISTORIAL.ESTADO]: '🔄',
  [TIPOS_HISTORIAL.ETAPA]: '📋',
  [TIPOS_HISTORIAL.DERIVACION]: '➡️',
  [TIPOS_HISTORIAL.PLAZO]: '⏰',
  [TIPOS_HISTORIAL.PRIORIDAD]: '⚡',
  [TIPOS_HISTORIAL.OBSERVACION]: '💬',
  [TIPOS_HISTORIAL.RECTORIA]: '🏛️',
  [TIPOS_HISTORIAL.FINALIZACION]: '✅',
  [TIPOS_HISTORIAL.EDICION]: '✏️',
};

function formatMomento(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const fecha = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${fecha} ${hora}`;
}

/** Historial de cambios en orden cronológico inverso (lo último, arriba). */
function HistorialTimeline({ historial = [], vacio = 'Sin movimientos registrados todavía.' }) {
  if (historial.length === 0) {
    return <p className="historial-vacio">{vacio}</p>;
  }
  const ordenado = [...historial].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

  return (
    <ol className="historial-timeline">
      {ordenado.map((ev, i) => (
        <li key={ev.id || `${ev.fecha}-${i}`} className="historial-item">
          <span className="historial-icono" aria-hidden="true">{ICONOS[ev.tipo] || '•'}</span>
          <div className="historial-cuerpo">
            <div className="historial-descripcion">{ev.descripcion}</div>
            <div className="historial-meta">
              {formatMomento(ev.fecha)}{ev.usuario ? ` · ${ev.usuario}` : ''}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

HistorialTimeline.propTypes = {
  historial: PropTypes.array,
  vacio: PropTypes.string,
};

export default HistorialTimeline;
