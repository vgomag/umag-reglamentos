import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  crearConvenio, crearEtapas, FLUJO_POR_DEFECTO, TIPOS_CONVENIO,
  PRIORIDADES, UNIDADES,
} from '../config/convenios';
import { hoyISO } from '../utils/fechas';
import { sanitizeField } from '../utils/sanitize';

/**
 * Alta de un convenio. Sólo pide lo mínimo indispensable; el resto
 * (seguimiento por unidad, historial) se completa desde la ficha.
 */
export default function NuevoConvenio({ onCrear, onCancelar }) {
  const [form, setForm] = useState(() => crearConvenio({ fechaIngreso: hoyISO() }));
  const [flujo, setFlujo] = useState(FLUJO_POR_DEFECTO);
  const [error, setError] = useState('');

  const set = (campo) => (e) => {
    const valor = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(prev => ({ ...prev, [campo]: valor }));
  };

  const toggleUnidad = (unidadId) => {
    setFlujo(prev => prev.includes(unidadId)
      ? prev.filter(u => u !== unidadId)
      // Mantiene el orden sugerido aunque se marquen las unidades en desorden.
      : FLUJO_POR_DEFECTO.filter(u => prev.includes(u) || u === unidadId));
  };

  const enviar = (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) { setError('El nombre del convenio es obligatorio.'); return; }
    if (!form.unidadOrigen.trim()) { setError('Indica la unidad de origen.'); return; }
    if (!form.fechaIngreso) { setError('La fecha de ingreso es obligatoria: define el orden de llegada.'); return; }
    setError('');
    onCrear(crearConvenio({
      ...form,
      nombre: sanitizeField(form.nombre, 300),
      codigo: sanitizeField(form.codigo, 60),
      unidadOrigen: sanitizeField(form.unidadOrigen, 150),
      contraparte: sanitizeField(form.contraparte, 200),
      motivoPrioridad: sanitizeField(form.motivoPrioridad, 300),
      plazoEspecial: Boolean(form.fechaLimite) || form.plazoEspecial,
      etapas: crearEtapas(flujo),
    }));
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Nuevo convenio</h2>
        <p>Registra el convenio al momento de su ingreso</p>
      </div>

      <form onSubmit={enviar}>
        <div className="detail-sections">
          <div className="section">
            <h3 className="section-title">Datos del convenio</h3>
            <div className="form-group">
              <label>Nombre del convenio *</label>
              <input type="text" value={form.nombre} onChange={set('nombre')} placeholder="ej: Convenio marco con Hospital Clínico de Magallanes" autoFocus />
            </div>
            <div className="form-group">
              <label>Código interno</label>
              <input type="text" value={form.codigo} onChange={set('codigo')} placeholder="ej: CONV-2026-014" />
            </div>
            <div className="form-group">
              <label>Unidad de origen *</label>
              <input type="text" value={form.unidadOrigen} onChange={set('unidadOrigen')} placeholder="Unidad que ingresa el convenio" />
            </div>
            <div className="form-group">
              <label>Contraparte</label>
              <input type="text" value={form.contraparte} onChange={set('contraparte')} />
            </div>
            <div className="form-group">
              <label>Tipo de convenio</label>
              <select value={form.tipo} onChange={set('tipo')}>
                <option value="">Sin especificar</option>
                {TIPOS_CONVENIO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Fecha de ingreso *</label>
              <input type="date" value={form.fechaIngreso} onChange={set('fechaIngreso')} />
              <div className="ayuda-campo">Define la posición en la cola: los convenios se atienden por orden de llegada.</div>
            </div>
            <div className="form-group">
              <label>Observaciones</label>
              <textarea
                value={form.observaciones} onChange={set('observaciones')}
                style={{ minHeight: '120px', width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontFamily: 'inherit', fontSize: '0.9rem', resize: 'vertical' }}
              />
            </div>
          </div>

          <div className="section">
            <h3 className="section-title">Plazo (opcional)</h3>
            <p className="nota-seccion">
              Déjalo en blanco si el convenio no trae una fecha comprometida: se tramitará
              por orden de llegada y aparecerá como 🔵 Sin plazo especial.
            </p>
            <div className="form-group">
              <label>Fecha límite</label>
              <input type="date" value={form.fechaLimite} onChange={set('fechaLimite')} />
            </div>
            <div className="form-group">
              <label>Prioridad</label>
              <select value={form.prioridad} onChange={set('prioridad')}>
                {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Motivo de la prioridad</label>
              <input type="text" value={form.motivoPrioridad} onChange={set('motivoPrioridad')} placeholder="Requerido si la prioridad no es normal" />
            </div>

            <h3 className="section-title" style={{ marginTop: '1.5rem' }}>Unidades que participan</h3>
            <p className="nota-seccion">
              Marca sólo las unidades que revisarán este convenio. Se puede ajustar después
              desde la ficha: no todos los convenios pasan por todas las unidades.
            </p>
            <div className="unidades-check">
              {UNIDADES.map(u => (
                <label key={u.id} className="checkbox-label" title={u.descripcion}>
                  <input type="checkbox" checked={flujo.includes(u.id)} onChange={() => toggleUnidad(u.id)} />
                  {u.nombre}
                </label>
              ))}
            </div>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="btn-group">
          <button type="submit" className="btn btn-primary">Registrar convenio</button>
          <button type="button" className="btn btn-secondary" onClick={onCancelar}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}

NuevoConvenio.propTypes = {
  onCrear: PropTypes.func.isRequired,
  onCancelar: PropTypes.func.isRequired,
};
