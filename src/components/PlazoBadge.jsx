import React from 'react';
import PropTypes from 'prop-types';
import { infoPlazo, textoPlazo } from '../utils/conveniosLogic';
import { formatFecha } from '../utils/fechas';

/**
 * Semáforo de plazos de un convenio (regla de negocio N°4).
 * 🟢 en plazo · 🟡 próximo a vencer · 🔴 vencido · 🔵 sin plazo · ⚫ finalizado
 */
function PlazoBadge({ convenio, mostrarFecha = false, compacto = false }) {
  const info = infoPlazo(convenio);
  const titulo = info.fechaLimite
    ? `${info.label} — límite ${formatFecha(info.fechaLimite)}`
    : info.label;

  return (
    <span className={`plazo-badge ${info.clase}`} title={titulo}>
      <span className="plazo-badge-icono" aria-hidden="true">{info.icono}</span>
      {!compacto && <span>{info.label}</span>}
      {mostrarFecha && info.fechaLimite && (
        <span className="plazo-badge-fecha">{formatFecha(info.fechaLimite)} · {textoPlazo(convenio)}</span>
      )}
    </span>
  );
}

PlazoBadge.propTypes = {
  convenio: PropTypes.object.isRequired,
  mostrarFecha: PropTypes.bool,
  compacto: PropTypes.bool,
};

export default PlazoBadge;
