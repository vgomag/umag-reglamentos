import React from 'react';
import PropTypes from 'prop-types';
import { nombreUnidad } from '../config/convenios';
import { ubicacionActual, estaFinalizado } from '../utils/conveniosLogic';
import { formatFecha } from '../utils/fechas';

const CLASE_ESTADO = {
  'Pendiente': 'pendiente',
  'En Revisión': 'en-revision',
  'Aprobado': 'aprobado',
  'Observado': 'observado',
  'No Aplica': 'no-aplica',
};

/**
 * Línea de flujo del convenio:
 * Ingresado → VRAF → VRAC → … → Rectoría → Finalizado
 *
 * El flujo se dibuja a partir de las etapas del convenio, no de una constante,
 * porque cada convenio puede tener su propio recorrido (reglas N°5 y N°6).
 */
function FlujoEtapas({ convenio, onSeleccionarEtapa }) {
  const ubicacion = ubicacionActual(convenio);
  const etapas = [...(convenio.etapas || [])].sort((a, b) => a.orden - b.orden);
  const finalizado = estaFinalizado(convenio);

  return (
    <div className="flujo-etapas" role="list">
      <div className={`flujo-nodo ${ubicacion === 'INGRESADO' ? 'actual' : 'completado'}`} role="listitem">
        <div className="flujo-nodo-titulo">Ingresado</div>
        <div className="flujo-nodo-fecha">{formatFecha(convenio.fechaIngreso)}</div>
      </div>

      {etapas.map(etapa => {
        const esActual = ubicacion === etapa.unidad;
        const clase = CLASE_ESTADO[etapa.estado] || 'pendiente';
        return (
          <React.Fragment key={etapa.unidad}>
            <span className="flujo-flecha" aria-hidden="true">→</span>
            <div
              role="listitem"
              className={`flujo-nodo ${clase} ${esActual ? 'actual' : ''} ${onSeleccionarEtapa ? 'clickable' : ''}`}
              onClick={onSeleccionarEtapa ? () => onSeleccionarEtapa(etapa) : undefined}
              title={etapa.observaciones || etapa.estado}
            >
              <div className="flujo-nodo-titulo">{nombreUnidad(etapa.unidad)}</div>
              <div className="flujo-nodo-estado">{etapa.estado}</div>
              {(etapa.fechaInicio || etapa.fechaTermino) && (
                <div className="flujo-nodo-fecha">
                  {etapa.fechaInicio ? formatFecha(etapa.fechaInicio) : '—'}
                  {etapa.fechaTermino ? ` → ${formatFecha(etapa.fechaTermino)}` : ''}
                </div>
              )}
            </div>
          </React.Fragment>
        );
      })}

      <span className="flujo-flecha" aria-hidden="true">→</span>
      <div className={`flujo-nodo ${finalizado ? 'actual aprobado' : ''}`} role="listitem">
        <div className="flujo-nodo-titulo">Finalizado</div>
        <div className="flujo-nodo-fecha">
          {convenio.fechaEntregaRectoria ? formatFecha(convenio.fechaEntregaRectoria) : '—'}
        </div>
      </div>
    </div>
  );
}

FlujoEtapas.propTypes = {
  convenio: PropTypes.object.isRequired,
  onSeleccionarEtapa: PropTypes.func,
};

export default FlujoEtapas;
