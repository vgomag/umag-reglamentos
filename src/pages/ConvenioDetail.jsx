import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  ESTADOS_CONVENIO, ESTADOS_ETAPA, PRIORIDADES, TIPOS_CONVENIO,
  UNIDADES, FLUJO_POR_DEFECTO, crearEtapa, nombreUnidad,
} from '../config/convenios';
import { textoPlazo, etiquetaUbicacion, progresoConvenio } from '../utils/conveniosLogic';
import { formatFecha, hoyISO, duracionDias } from '../utils/fechas';
import { eventosDeConvenio, urlGoogleCalendar, descargarICS } from '../utils/googleCalendar';
import PlazoBadge from '../components/PlazoBadge';
import FlujoEtapas from '../components/FlujoEtapas';
import HistorialTimeline from '../components/HistorialTimeline';

/**
 * Ficha completa de un convenio: datos, plazos, seguimiento por unidad,
 * historial y fechas exportables al calendario.
 */
export default function ConvenioDetail({ convenio, onBack, onSave, onDelete }) {
  const [form, setForm] = useState(convenio);

  useEffect(() => { setForm(convenio); }, [convenio]);

  const cambios = JSON.stringify(form) !== JSON.stringify(convenio);

  const volver = () => {
    if (cambios && !window.confirm('Tienes cambios sin guardar. ¿Salir de todos modos?')) return;
    onBack();
  };

  const set = (campo, valor) => setForm(prev => ({ ...prev, [campo]: valor }));
  const setInput = (campo) => (e) => set(campo, e.target.value);

  /* ----------------------- etapas de seguimiento ------------------ */

  const setEtapa = (unidad, campo, valor) => {
    setForm(prev => ({
      ...prev,
      etapas: prev.etapas.map(e => e.unidad === unidad ? { ...e, [campo]: valor } : e),
    }));
  };

  // Marcar recepción: fija la fecha de inicio de hoy y pone la etapa en revisión.
  const recibirEnUnidad = (unidad) => {
    setForm(prev => ({
      ...prev,
      estado: prev.estado === 'Ingresado' ? 'En Tramitación' : prev.estado,
      etapas: prev.etapas.map(e => e.unidad === unidad
        ? { ...e, estado: 'En Revisión', fechaInicio: e.fechaInicio || hoyISO() }
        : e),
    }));
  };

  // Cerrar etapa: fija término de hoy y la aprueba.
  const cerrarEtapa = (unidad) => {
    setForm(prev => ({
      ...prev,
      etapas: prev.etapas.map(e => e.unidad === unidad
        ? { ...e, estado: 'Aprobado', fechaTermino: e.fechaTermino || hoyISO() }
        : e),
    }));
  };

  const agregarEtapa = (unidadId) => {
    if (!unidadId || form.etapas.some(e => e.unidad === unidadId)) return;
    const orden = form.etapas.reduce((max, e) => Math.max(max, e.orden), -1) + 1;
    setForm(prev => ({ ...prev, etapas: [...prev.etapas, crearEtapa(unidadId, orden)] }));
  };

  const quitarEtapa = (unidadId) => {
    if (!window.confirm(`¿Quitar la etapa ${nombreUnidad(unidadId)} del flujo de este convenio?`)) return;
    setForm(prev => ({
      ...prev,
      etapas: prev.etapas.filter(e => e.unidad !== unidadId).map((e, i) => ({ ...e, orden: i })),
    }));
  };

  const moverEtapa = (unidadId, delta) => {
    setForm(prev => {
      const etapas = [...prev.etapas].sort((a, b) => a.orden - b.orden);
      const i = etapas.findIndex(e => e.unidad === unidadId);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= etapas.length) return prev;
      [etapas[i], etapas[j]] = [etapas[j], etapas[i]];
      return { ...prev, etapas: etapas.map((e, idx) => ({ ...e, orden: idx })) };
    });
  };

  const restaurarFlujo = () => {
    if (!window.confirm('¿Restaurar el flujo sugerido? Se conservan las fechas y estados ya registrados en cada unidad.')) return;
    setForm(prev => {
      const previas = new Map(prev.etapas.map(e => [e.unidad, e]));
      return {
        ...prev,
        etapas: FLUJO_POR_DEFECTO.map((unidad, i) => ({ ...crearEtapa(unidad, i), ...(previas.get(unidad) || {}), orden: i })),
      };
    });
  };

  const entregarARectoria = () => {
    setForm(prev => ({
      ...prev,
      fechaEntregaRectoria: prev.fechaEntregaRectoria || hoyISO(),
      estado: prev.estado === 'Finalizado' ? prev.estado : 'Pendiente Rectoría',
    }));
  };

  const etapasOrdenadas = [...(form.etapas || [])].sort((a, b) => a.orden - b.orden);
  const unidadesDisponibles = UNIDADES.filter(u => !form.etapas.some(e => e.unidad === u.id));
  const eventos = eventosDeConvenio(form);

  return (
    <div className="page-content">
      <button className="btn btn-secondary btn-small" onClick={volver} style={{ marginBottom: '1rem' }}>← Volver al listado</button>

      <div className="detail-header">
        <div>
          <div className="detail-title">{form.nombre || 'Convenio sin nombre'}</div>
          <div className="detail-meta">
            {form.codigo && <span className="detail-badge">{form.codigo}</span>}
            <span className="detail-badge">{form.unidadOrigen || 'Sin unidad de origen'}</span>
            <span className="detail-badge">Ingresó {formatFecha(form.fechaIngreso)}</span>
            <span className="detail-badge">Ahora en {etiquetaUbicacion(form)}</span>
            <span className="detail-badge">{progresoConvenio(form)}% de avance</span>
          </div>
        </div>
        <PlazoBadge convenio={form} mostrarFecha />
      </div>

      <div className="section" style={{ marginBottom: '1.5rem' }}>
        <h3 className="section-title">Flujo de tramitación</h3>
        <FlujoEtapas convenio={form} />
        <p className="nota-seccion">
          El flujo se adapta a cada convenio: puedes quitar unidades que no participan,
          agregar otras o cambiar el orden desde la sección Seguimiento.
        </p>
      </div>

      <div className="detail-sections">
        <div className="section">
          <h3 className="section-title">Información general</h3>
          <div className="form-group">
            <label>Nombre del convenio *</label>
            <input type="text" value={form.nombre} onChange={setInput('nombre')} />
          </div>
          <div className="form-group">
            <label>Código interno</label>
            <input type="text" value={form.codigo} onChange={setInput('codigo')} placeholder="ej: CONV-2026-014" />
          </div>
          <div className="form-group">
            <label>Unidad de origen *</label>
            <input type="text" value={form.unidadOrigen} onChange={setInput('unidadOrigen')} placeholder="ej: Facultad de Ingeniería" />
          </div>
          <div className="form-group">
            <label>Contraparte</label>
            <input type="text" value={form.contraparte} onChange={setInput('contraparte')} placeholder="Institución con la que se firma" />
          </div>
          <div className="form-group">
            <label>Tipo de convenio</label>
            <select value={form.tipo} onChange={setInput('tipo')}>
              <option value="">Sin especificar</option>
              {TIPOS_CONVENIO.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Fecha de ingreso *</label>
            <input type="date" value={form.fechaIngreso} onChange={setInput('fechaIngreso')} />
          </div>
          <div className="form-group">
            <label>Fecha de entrega a Rectoría</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="date" value={form.fechaEntregaRectoria} onChange={setInput('fechaEntregaRectoria')} />
              <button className="btn btn-secondary btn-small" onClick={entregarARectoria} title="Registrar la entrega con fecha de hoy">Hoy</button>
            </div>
          </div>
          <div className="form-group">
            <label>Estado actual</label>
            <select value={form.estado} onChange={setInput('estado')}>
              {ESTADOS_CONVENIO.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        </div>

        <div className="section">
          <h3 className="section-title">Plazos y prioridad</h3>
          <p className="nota-seccion">
            No existe un plazo general para todos los convenios: la atención es por orden de
            llegada. Sólo marca un plazo especial cuando el convenio traiga una fecha límite.
          </p>
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox" checked={form.plazoEspecial}
                onChange={(e) => set('plazoEspecial', e.target.checked)}
              />
              Este convenio tiene plazo especial
            </label>
          </div>
          <div className="form-group">
            <label>Fecha límite</label>
            <input type="date" value={form.fechaLimite} onChange={(e) => {
              const valor = e.target.value;
              setForm(prev => ({ ...prev, fechaLimite: valor, plazoEspecial: valor ? true : prev.plazoEspecial }));
            }} />
            {form.fechaLimite && <div className="ayuda-campo">{textoPlazo(form)}</div>}
          </div>
          <div className="form-group">
            <label>Prioridad</label>
            <select value={form.prioridad} onChange={setInput('prioridad')}>
              {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Motivo de la prioridad</label>
            <input
              type="text" value={form.motivoPrioridad} onChange={setInput('motivoPrioridad')}
              placeholder="ej: fecha de firma comprometida con la contraparte"
            />
          </div>
          <div className="form-group">
            <label>Observaciones generales</label>
            <textarea
              value={form.observaciones} onChange={setInput('observaciones')}
              placeholder="Antecedentes, acuerdos, pendientes..."
              style={{ minHeight: '160px', width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontFamily: 'inherit', fontSize: '0.9rem', resize: 'vertical' }}
            />
          </div>
        </div>
      </div>

      <div className="section" style={{ marginBottom: '1.5rem' }}>
        <h3 className="section-title">Seguimiento por unidad</h3>
        <div className="table-container">
          <table className="tabla-seguimiento">
            <thead>
              <tr>
                <th>Orden</th>
                <th>Unidad</th>
                <th>Inicio</th>
                <th>Término</th>
                <th>Duración</th>
                <th>Estado del trámite</th>
                <th>Observaciones</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {etapasOrdenadas.map((etapa, i) => (
                <tr key={etapa.unidad} className={etapa.estado === 'No Aplica' ? 'fila-inactiva' : ''}>
                  <td>
                    <div className="orden-etapa">
                      <button className="btn-icono" disabled={i === 0} onClick={() => moverEtapa(etapa.unidad, -1)} title="Subir">↑</button>
                      <button className="btn-icono" disabled={i === etapasOrdenadas.length - 1} onClick={() => moverEtapa(etapa.unidad, 1)} title="Bajar">↓</button>
                    </div>
                  </td>
                  <td title={UNIDADES.find(u => u.id === etapa.unidad)?.descripcion || ''}>
                    <strong>{nombreUnidad(etapa.unidad)}</strong>
                  </td>
                  <td><input type="date" value={etapa.fechaInicio} onChange={(e) => setEtapa(etapa.unidad, 'fechaInicio', e.target.value)} /></td>
                  <td><input type="date" value={etapa.fechaTermino} onChange={(e) => setEtapa(etapa.unidad, 'fechaTermino', e.target.value)} /></td>
                  <td>{duracionDias(etapa.fechaInicio, etapa.fechaTermino) !== null ? `${duracionDias(etapa.fechaInicio, etapa.fechaTermino)} d` : '—'}</td>
                  <td>
                    <select value={etapa.estado} onChange={(e) => setEtapa(etapa.unidad, 'estado', e.target.value)}>
                      {ESTADOS_ETAPA.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      type="text" value={etapa.observaciones}
                      onChange={(e) => setEtapa(etapa.unidad, 'observaciones', e.target.value)}
                      placeholder="Observaciones de la unidad"
                    />
                  </td>
                  <td>
                    <div className="acciones-etapa">
                      <button className="btn btn-secondary btn-small" onClick={() => recibirEnUnidad(etapa.unidad)} title="Marcar recepción hoy">Recibió</button>
                      <button className="btn btn-secondary btn-small" onClick={() => cerrarEtapa(etapa.unidad)} title="Cerrar etapa hoy">Visó</button>
                      <button className="btn btn-danger btn-small" onClick={() => quitarEtapa(etapa.unidad)} title="Quitar del flujo">✕</button>
                    </div>
                  </td>
                </tr>
              ))}
              {etapasOrdenadas.length === 0 && (
                <tr><td colSpan="8" style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem' }}>Este convenio no tiene etapas configuradas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="acciones-flujo">
          <select className="filter-select" value="" onChange={(e) => agregarEtapa(e.target.value)} disabled={unidadesDisponibles.length === 0}>
            <option value="">
              {unidadesDisponibles.length === 0 ? 'Todas las unidades ya están en el flujo' : '+ Agregar unidad al flujo'}
            </option>
            {unidadesDisponibles.map(u => <option key={u.id} value={u.id}>{u.nombre} — {u.descripcion}</option>)}
          </select>
          <button className="btn btn-secondary btn-small" onClick={restaurarFlujo}>Restaurar flujo sugerido</button>
        </div>
      </div>

      <div className="btn-group" style={{ marginBottom: '1.5rem' }}>
        <button className="btn btn-primary" onClick={() => onSave(form)} disabled={!form.nombre}>
          Guardar cambios{cambios ? ' *' : ''}
        </button>
        <button className="btn btn-secondary" onClick={() => setForm(convenio)} disabled={!cambios}>Descartar</button>
        <button className="btn btn-danger" onClick={onDelete}>Eliminar convenio</button>
      </div>

      <div className="detail-sections">
        <div className="section">
          <h3 className="section-title">Fechas para el calendario</h3>
          {eventos.length === 0 ? (
            <p className="historial-vacio">Aún no hay fechas registradas en este convenio.</p>
          ) : (
            <>
              <div className="lista-compacta">
                {eventos.map(ev => (
                  <div key={ev.uid} className="lista-compacta-item">
                    <span aria-hidden="true">{ev.icono}</span>
                    <div className="lista-compacta-texto">
                      <div className="lista-compacta-titulo">{ev.titulo}</div>
                      <div className="lista-compacta-meta">{ev.tipoLabel} · {formatFecha(ev.fecha)}</div>
                    </div>
                    <a className="btn btn-secondary btn-small" href={urlGoogleCalendar(ev)} target="_blank" rel="noopener noreferrer">
                      Google Calendar
                    </a>
                  </div>
                ))}
              </div>
              <button
                className="btn btn-secondary btn-small" style={{ marginTop: '0.75rem' }}
                onClick={() => descargarICS(eventos, `convenio-${form.codigo || form.id}.ics`)}
              >
                📅 Exportar fechas (.ics)
              </button>
            </>
          )}
        </div>

        <div className="section">
          <h3 className="section-title">Historial y trazabilidad</h3>
          <HistorialTimeline historial={form.historial} />
        </div>
      </div>
    </div>
  );
}

ConvenioDetail.propTypes = {
  convenio: PropTypes.object.isRequired,
  onBack: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};
