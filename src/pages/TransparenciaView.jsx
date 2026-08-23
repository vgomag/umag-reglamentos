import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  ESTADOS_SOLICITUD, ETAPAS_SOLICITUD, PLAZOS_LEY_20285, TIPOS_PERSONA,
  VIAS_INGRESO, FORMATOS_ENTREGA, MEDIOS_ENVIO, CAUSALES_RESERVA, crearSolicitud,
} from '../config/transparencia';
import {
  filtrarSolicitudes, ordenarSolicitudes, infoPlazoSolicitud, textoPlazoSolicitud,
  resumenSolicitudes, fechaVencimiento, fechaTopeSubsanacion, fechaTopeOposicion,
  fechaTopeAmparo, solicitudCerrada,
} from '../utils/transparenciaLogic';
import { formatFecha, hoyISO } from '../utils/fechas';
import { UNIDADES } from '../config/convenios';
import HistorialTimeline from '../components/HistorialTimeline';

/**
 * Transparencia pasiva (Ley N°20.285): registro y control de plazos de las
 * solicitudes de acceso a la información.
 *
 * Los plazos NO se digitan: se calculan en días hábiles a partir de la fecha
 * de ingreso, igual que lo hace el Portal de Transparencia.
 */
export default function TransparenciaView({ solicitudes, onGuardar, onCrear, onEliminar }) {
  const [filtros, setFiltros] = useState({ busqueda: '', estado: '', etapa: '', plazo: '', situacion: 'pendientes' });
  const [orden, setOrden] = useState('vencimiento');
  const [seleccion, setSeleccion] = useState(null);
  const [creando, setCreando] = useState(false);

  const stats = resumenSolicitudes(solicitudes);
  const visibles = useMemo(
    () => ordenarSolicitudes(filtrarSolicitudes(solicitudes, filtros), orden),
    [solicitudes, filtros, orden],
  );

  const set = (campo) => (e) => setFiltros(prev => ({ ...prev, [campo]: e.target.value }));

  if (creando) {
    return <FormularioSolicitud
      inicial={crearSolicitud({ fechaIngreso: hoyISO() })}
      titulo="Nueva solicitud de acceso a la información"
      onGuardar={(s) => { onCrear(s); setCreando(false); }}
      onCancelar={() => setCreando(false)}
    />;
  }

  if (seleccion) {
    const actual = solicitudes.find(s => s.id === seleccion) || null;
    if (!actual) {
      // La solicitud desapareció (se eliminó en otra pestaña o falló el guardado).
      return (
        <div className="page-content">
          <p className="historial-vacio">Esa solicitud ya no existe.</p>
          <button className="btn btn-secondary" onClick={() => setSeleccion(null)}>Volver al listado</button>
        </div>
      );
    }
    return <FormularioSolicitud
      inicial={actual}
      titulo={`Solicitud ${actual.codigo || actual.id}`}
      onGuardar={(s) => { onGuardar(s); setSeleccion(null); }}
      onCancelar={() => setSeleccion(null)}
      onEliminar={() => { onEliminar(actual); setSeleccion(null); }}
    />;
  }

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Transparencia pasiva</h2>
          <p>Solicitudes de acceso a la información — Ley N°20.285</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreando(true)}>+ Nueva solicitud</button>
      </div>

      <div className="dashboard-grid">
        <div className="metric-card"><div className="metric-value">{stats.total}</div><div className="metric-label">Total de solicitudes</div></div>
        <div className="metric-card warning"><div className="metric-value">{stats.enTramite}</div><div className="metric-label">En tramitación</div></div>
        <div className="metric-card danger"><div className="metric-value">{stats.vencidas}</div><div className="metric-label">Plazo vencido</div></div>
        <div className="metric-card warning"><div className="metric-value">{stats.porVencer}</div><div className="metric-label">Próximas a vencer</div></div>
        <div className="metric-card"><div className="metric-value">{stats.prorrogadas}</div><div className="metric-label">Con prórroga</div></div>
        <div className="metric-card success"><div className="metric-value">{stats.respondidas}</div><div className="metric-label">Respondidas</div></div>
      </div>

      <div className="filters-bar">
        <input type="text" className="search-input" placeholder="Buscar por código, solicitante o materia..." value={filtros.busqueda} onChange={set('busqueda')} />
        <select className="filter-select" value={filtros.estado} onChange={set('estado')}>
          <option value="">Todos los estados</option>
          {ESTADOS_SOLICITUD.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select className="filter-select" value={filtros.etapa} onChange={set('etapa')}>
          <option value="">Todas las etapas</option>
          {ETAPAS_SOLICITUD.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select className="filter-select" value={filtros.plazo} onChange={set('plazo')}>
          <option value="">Cualquier plazo</option>
          <option value="en-plazo">🟢 En plazo</option>
          <option value="por-vencer">🟡 Próximas a vencer</option>
          <option value="vencido">🔴 Vencidas</option>
        </select>
        <select className="filter-select" value={filtros.situacion} onChange={set('situacion')}>
          <option value="">Todas</option>
          <option value="pendientes">Pendientes</option>
          <option value="cerradas">Cerradas</option>
        </select>
        <select className="filter-select" value={orden} onChange={(e) => setOrden(e.target.value)}>
          <option value="vencimiento">Orden: vencimiento más próximo</option>
          <option value="ingreso">Orden: fecha de ingreso</option>
          <option value="codigo">Orden: código</option>
        </select>
      </div>

      <div className="results-count">{visibles.length} de {solicitudes.length} solicitudes</div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Plazo</th>
              <th>Código</th>
              <th>Solicitante</th>
              <th>Materia</th>
              <th>Ingreso</th>
              <th>Vence (Art. 14)</th>
              <th>Etapa</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(s => {
              const info = infoPlazoSolicitud(s);
              return (
                <tr key={s.id} className={`fila-${info.key}`}>
                  <td title={textoPlazoSolicitud(s)}><span aria-hidden="true">{info.icono}</span></td>
                  <td><strong>{s.codigo || '—'}</strong></td>
                  <td>{s.solicitante || '—'}</td>
                  <td className="celda-materia" title={s.materia}>{(s.materia || '').slice(0, 90)}{(s.materia || '').length > 90 ? '…' : ''}</td>
                  <td>{formatFecha(s.fechaIngreso)}</td>
                  <td>
                    {formatFecha(fechaVencimiento(s))}
                    <div className="celda-sub">{textoPlazoSolicitud(s)}{s.prorrogada ? ' · prorrogada' : ''}</div>
                  </td>
                  <td>{s.etapa}</td>
                  <td><span className={`badge ${solicitudCerrada(s) ? 'aprobado' : 'en-proceso'}`}>{s.estado}</span></td>
                  <td><button className="btn btn-primary btn-small" onClick={() => setSeleccion(s.id)}>Ver</button></td>
                </tr>
              );
            })}
            {visibles.length === 0 && (
              <tr><td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                {solicitudes.length === 0
                  ? 'Aún no hay solicitudes registradas.'
                  : 'Ninguna solicitud coincide con esos filtros.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="section" style={{ marginTop: '1.5rem' }}>
        <h3 className="section-title">Plazos legales aplicables</h3>
        <div className="table-container">
          <table>
            <thead><tr><th>Trámite</th><th>Plazo</th><th>Norma</th><th>Detalle</th></tr></thead>
            <tbody>
              {Object.entries(PLAZOS_LEY_20285).map(([clave, p]) => (
                <tr key={clave}>
                  <td>{clave.replace(/_/g, ' ').toLowerCase()}</td>
                  <td><strong>{p.dias} días hábiles</strong></td>
                  <td>{p.articulo}</td>
                  <td>{p.descripcion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="nota-seccion">
          Los días hábiles excluyen sábados, domingos y festivos (Ley 19.880, art. 25).
          El calendario de feriados está en <code>src/config/feriados.js</code> y debe revisarse cada año.
        </p>
      </div>
    </div>
  );
}

TransparenciaView.propTypes = {
  solicitudes: PropTypes.array.isRequired,
  onGuardar: PropTypes.func.isRequired,
  onCrear: PropTypes.func.isRequired,
  onEliminar: PropTypes.func.isRequired,
};

/* ------------------------------------------------------------------ */

function FormularioSolicitud({ inicial, titulo, onGuardar, onCancelar, onEliminar }) {
  const [form, setForm] = useState(inicial);
  const [error, setError] = useState('');

  const set = (campo) => (e) => {
    const valor = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(prev => ({ ...prev, [campo]: valor }));
  };

  const info = infoPlazoSolicitud(form);
  const vencimiento = fechaVencimiento(form);
  const topeSubsanacion = fechaTopeSubsanacion(form);
  const topeOposicion = fechaTopeOposicion(form);
  const topeAmparo = fechaTopeAmparo(form);

  const guardar = (e) => {
    e.preventDefault();
    if (!form.fechaIngreso) { setError('La fecha de ingreso es obligatoria: de ella dependen todos los plazos legales.'); return; }
    if (!form.materia.trim()) { setError('Describe la información solicitada.'); return; }
    setError('');
    onGuardar(form);
  };

  return (
    <div className="page-content">
      <button className="btn btn-secondary btn-small" onClick={onCancelar} style={{ marginBottom: '1rem' }}>← Volver a solicitudes</button>

      <div className="detail-header">
        <div>
          <div className="detail-title">{titulo}</div>
          <div className="detail-meta">
            <span className="detail-badge">{form.estado}</span>
            <span className="detail-badge">{form.etapa}</span>
            {vencimiento && <span className="detail-badge">Vence {formatFecha(vencimiento)}</span>}
          </div>
        </div>
        <span className="plazo-badge" style={{ borderColor: info.color, color: info.color }}>
          <span aria-hidden="true">{info.icono}</span> {info.label}
        </span>
      </div>

      <form onSubmit={guardar}>
        <div className="detail-sections">
          <div className="section">
            <h3 className="section-title">Solicitud</h3>
            <div className="form-group">
              <label>Código de solicitud</label>
              <input type="text" value={form.codigo} onChange={set('codigo')} placeholder="ej: UN016T0000633" />
            </div>
            <div className="form-group">
              <label>Fecha de ingreso *</label>
              <input type="date" value={form.fechaIngreso} onChange={set('fechaIngreso')} />
            </div>
            <div className="form-group">
              <label>Vía de ingreso</label>
              <select value={form.viaIngreso} onChange={set('viaIngreso')}>
                {VIAS_INGRESO.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Información solicitada *</label>
              <textarea
                value={form.materia} onChange={set('materia')}
                style={{ minHeight: '140px', width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontFamily: 'inherit', fontSize: '0.9rem', resize: 'vertical' }}
              />
            </div>
            <div className="form-group">
              <label>Unidad a la que se derivó</label>
              <input list="unidades-umag" type="text" value={form.unidadDerivada} onChange={set('unidadDerivada')} placeholder="Unidad responsable de la materia" />
              <datalist id="unidades-umag">
                {UNIDADES.map(u => <option key={u.id} value={u.nombre} />)}
              </datalist>
            </div>
          </div>

          <div className="section">
            <h3 className="section-title">Solicitante</h3>
            <div className="form-group">
              <label>Nombre</label>
              <input type="text" value={form.solicitante} onChange={set('solicitante')} />
            </div>
            <div className="form-group">
              <label>Tipo de persona</label>
              <select value={form.tipoPersona} onChange={set('tipoPersona')}>
                {TIPOS_PERSONA.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Correo de notificaciones</label>
              <input type="email" value={form.email} onChange={set('email')} />
            </div>
            <div className="form-group">
              <label>Teléfono</label>
              <input type="text" value={form.telefono} onChange={set('telefono')} />
            </div>
            <div className="form-group">
              <label>Formato de entrega</label>
              <select value={form.formatoEntrega} onChange={set('formatoEntrega')}>
                {FORMATOS_ENTREGA.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Medio de envío</label>
              <select value={form.medioEnvio} onChange={set('medioEnvio')}>
                {MEDIOS_ENVIO.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="detail-sections">
          <div className="section">
            <h3 className="section-title">Tramitación</h3>
            <div className="form-group">
              <label>Etapa</label>
              <select value={form.etapa} onChange={set('etapa')}>
                {ETAPAS_SOLICITUD.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Estado</label>
              <select value={form.estado} onChange={set('estado')}>
                {ESTADOS_SOLICITUD.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="checkbox-label">
                <input type="checkbox" checked={form.prorrogada} onChange={set('prorrogada')} />
                Prórroga comunicada (+10 días hábiles, Art. 14)
              </label>
            </div>
            <div className="form-group">
              <label className="checkbox-label">
                <input type="checkbox" checked={form.subsanacionSolicitada} onChange={set('subsanacionSolicitada')} />
                Se requirió subsanación (Art. 12)
              </label>
            </div>
            {form.subsanacionSolicitada && (
              <div className="form-group">
                <label>Fecha de notificación de la subsanación</label>
                <input type="date" value={form.fechaSubsanacion} onChange={set('fechaSubsanacion')} />
              </div>
            )}
            <div className="form-group">
              <label className="checkbox-label">
                <input type="checkbox" checked={form.terceroInvolucrado} onChange={set('terceroInvolucrado')} />
                Afecta derechos de terceros (Art. 20)
              </label>
            </div>
            <div className="form-group">
              <label>Fecha de respuesta</label>
              <input type="date" value={form.fechaRespuesta} onChange={set('fechaRespuesta')} />
            </div>
            <div className="form-group">
              <label>Causal de reserva invocada (si se deniega)</label>
              <select value={form.causalReserva} onChange={set('causalReserva')}>
                <option value="">No aplica</option>
                {CAUSALES_RESERVA.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Observaciones</label>
              <textarea
                value={form.observaciones} onChange={set('observaciones')}
                style={{ minHeight: '100px', width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontFamily: 'inherit', fontSize: '0.9rem', resize: 'vertical' }}
              />
            </div>
          </div>

          <div className="section">
            <h3 className="section-title">Plazos calculados</h3>
            <table className="tabla-plazos">
              <tbody>
                <tr>
                  <th>Respuesta (Art. 14)</th>
                  <td>{formatFecha(vencimiento)}</td>
                  <td>{textoPlazoSolicitud(form)}</td>
                </tr>
                <tr>
                  <th>Subsanación (Art. 12)</th>
                  <td>{topeSubsanacion ? formatFecha(topeSubsanacion) : '—'}</td>
                  <td>{topeSubsanacion ? '5 días hábiles del solicitante' : 'No solicitada'}</td>
                </tr>
                <tr>
                  <th>Oposición de tercero (Art. 20)</th>
                  <td>{topeOposicion ? formatFecha(topeOposicion) : '—'}</td>
                  <td>{topeOposicion ? '2 días para notificar + 3 para oponerse' : 'Sin terceros'}</td>
                </tr>
                <tr>
                  <th>Amparo ante el CPLT (Art. 24)</th>
                  <td>{topeAmparo ? formatFecha(topeAmparo) : '—'}</td>
                  <td>15 días hábiles del solicitante</td>
                </tr>
              </tbody>
            </table>
            <p className="nota-seccion">
              Todos los plazos se recalculan solos a partir de la fecha de ingreso y de las
              casillas de prórroga y subsanación; no hay que digitarlos.
            </p>

            <h3 className="section-title" style={{ marginTop: '1.5rem' }}>Historial</h3>
            <HistorialTimeline historial={form.historial} />
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="btn-group">
          <button type="submit" className="btn btn-primary">Guardar solicitud</button>
          <button type="button" className="btn btn-secondary" onClick={onCancelar}>Cancelar</button>
          {onEliminar && <button type="button" className="btn btn-danger" onClick={onEliminar}>Eliminar</button>}
        </div>
      </form>
    </div>
  );
}

FormularioSolicitud.propTypes = {
  inicial: PropTypes.object.isRequired,
  titulo: PropTypes.string.isRequired,
  onGuardar: PropTypes.func.isRequired,
  onCancelar: PropTypes.func.isRequired,
  onEliminar: PropTypes.func,
};
