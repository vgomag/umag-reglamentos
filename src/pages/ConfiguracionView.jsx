import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  UNIDADES, FLUJO_POR_DEFECTO, ESTADOS_CONVENIO, ESTADOS_ETAPA,
  DIAS_ALERTA_VENCIMIENTO, SEMAFORO, normalizarConvenio,
} from '../config/convenios';
import { PLAZOS_LEY_20285 } from '../config/transparencia';
import { anioLimiteDeCalculo } from '../utils/transparenciaLogic';
import { estadoIntegracion } from '../utils/googleCalendar';
import { listarFeriados, hoyISO } from '../utils/fechas';
import { esRegistroEjemplo } from '../config/datosEjemplo';
import { sheetsConfigurado, probarConexion, SHEET_URL, DRIVE_FOLDER_URL } from '../config/sheetsStore';
import { etiquetaModo } from '../config/modoDatos';
import { compararVersionScript, VERSION_SCRIPT_ESPERADA } from '../config/versionScript';
import { usuarioDeSesion } from '../config/auth';

/**
 * Configuración: estado del almacenamiento, reglas vigentes del sistema,
 * integración de calendario e importación/exportación de respaldos.
 */
export default function ConfiguracionView({
  convenios, solicitudes, dbMode, cargando, onRecargar, onFalloRemoto,
  onImportarConvenios, onBorrarConvenios, onCargarEjemplos, onBorrarEjemplos,
}) {
  const inputRef = useRef(null);
  const [mensaje, setMensaje] = useState('');
  const integracion = estadoIntegracion();
  const feriados = listarFeriados().filter(f => f >= hoyISO()).slice(0, 8);

  // Los plazos de la Ley 20.285 se cuentan en días hábiles, así que dejan de
  // ser fiables en cuanto se acaba la tabla de feriados. Se avisa el mismo año
  // en que se agota, no cuando ya empezó a calcular mal.
  const anioLimite = anioLimiteDeCalculo();
  const faltanFeriados = anioLimite !== null && anioLimite <= Number(hoyISO().slice(0, 4));

  // Los registros de ejemplo se reconocen por el prefijo de su código, así se
  // pueden quitar después sin tocar los convenios reales.
  const ejemplos = convenios.filter(esRegistroEjemplo).length
    + solicitudes.filter(esRegistroEjemplo).length;
  const [prueba, setPrueba] = useState(null);
  const cuenta = usuarioDeSesion();

  const comprobar = async () => {
    setPrueba({ estado: 'probando' });
    const respuesta = await probarConexion();
    const { ok, error, version } = respuesta;
    // La versión llega incluso cuando la planilla rechaza la petición: saber
    // qué código está publicado es justamente lo que hace falta al diagnosticar.
    setPrueba({ estado: ok ? 'ok' : 'error', error, version: compararVersionScript(version) });
    // Este era el único camino que recibía un rechazo de identidad y no hacía
    // nada con él: la sesión caducada dejaba a la persona mirando un error en
    // Configuración, sin la vuelta a la pantalla de acceso que da el resto.
    if (!ok) onFalloRemoto(respuesta);
  };

  const respaldar = () => {
    const data = JSON.stringify({ version: 1, generado: new Date().toISOString(), convenios, solicitudes }, null, 2);
    const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `respaldo_transparencia_convenios_${hoyISO()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const texto = await file.text();
      const parsed = JSON.parse(texto);
      const lista = Array.isArray(parsed) ? parsed : parsed.convenios;
      if (!Array.isArray(lista)) throw new Error('El archivo no contiene una lista de convenios.');
      const normalizados = lista.map(normalizarConvenio).filter(Boolean);
      if (normalizados.length === 0) throw new Error('No se encontraron convenios válidos en el archivo.');
      if (!window.confirm(`Se importarán ${normalizados.length} convenio(s). Los actuales se conservan y los importados se agregan. ¿Continuar?`)) return;
      onImportarConvenios(normalizados);
      setMensaje(`${normalizados.length} convenio(s) importados.`);
    } catch (err) {
      setMensaje(`No se pudo importar: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Configuración</h2>
        <p>Reglas del sistema, almacenamiento e integraciones</p>
      </div>

      <div className="detail-sections">
        <div className="section">
          <h3 className="section-title">Almacenamiento</h3>
          <table className="tabla-plazos">
            <tbody>
              <tr>
                <th>Modo actual</th>
                <td>{etiquetaModo(dbMode)}</td>
              </tr>
              <tr>
                <th>Sesión iniciada como</th>
                <td>{cuenta ? `${cuenta.nombre} (${cuenta.email})` : '—'}</td>
              </tr>
              <tr><th>Convenios registrados</th><td>{convenios.length}</td></tr>
              <tr><th>Solicitudes registradas</th><td>{solicitudes.length}</td></tr>
              {SHEET_URL && (
                <tr>
                  <th>Planilla</th>
                  <td><a href={SHEET_URL} target="_blank" rel="noopener noreferrer">Abrir en Google Sheets</a></td>
                </tr>
              )}
              {DRIVE_FOLDER_URL && (
                <tr>
                  <th>Carpeta de documentos</th>
                  <td><a href={DRIVE_FOLDER_URL} target="_blank" rel="noopener noreferrer">Abrir en Google Drive</a></td>
                </tr>
              )}
            </tbody>
          </table>
          {sheetsConfigurado() ? (
            <>
              <div className="btn-group">
                <button className="btn btn-secondary btn-small" onClick={comprobar} disabled={prueba?.estado === 'probando'}>
                  {prueba?.estado === 'probando' ? 'Comprobando…' : '🔌 Comprobar conexión'}
                </button>
                <button className="btn btn-secondary btn-small" onClick={() => onRecargar()} disabled={cargando}>
                  {cargando ? 'Actualizando…' : '🔄 Actualizar desde la planilla'}
                </button>
              </div>
              <p className="nota-seccion">
                La planilla se lee al entrar. Si alguien más está trabajando en ella,
                usa «Actualizar» para traer sus cambios antes de editar.
              </p>
              {prueba?.estado === 'ok' && <p className="ayuda-campo">✓ La planilla responde correctamente.</p>}
              {prueba?.estado === 'error' && <p className="ayuda-campo">✕ {prueba.error}</p>}
              {prueba?.version && (
                prueba.version.alDia
                  ? <p className="ayuda-campo">✓ {prueba.version.mensaje}</p>
                  : (
                    <div className="form-error" style={{ marginTop: '0.5rem' }} role="alert">
                      ⚠️ {prueba.version.mensaje}
                    </div>
                  )
              )}
              <table className="tabla-plazos" style={{ marginTop: '0.75rem' }}>
                <tbody>
                  <tr>
                    <th>Versión del script que espera esta app</th>
                    <td>{VERSION_SCRIPT_ESPERADA}</td>
                  </tr>
                  <tr>
                    <th>Versión publicada en la planilla</th>
                    <td>{prueba?.version?.publicada || (prueba ? 'No informada' : 'Sin comprobar')}</td>
                  </tr>
                </tbody>
              </table>
            </>
          ) : (
            <p className="nota-seccion">
              Sin planilla configurada los datos viven sólo en este navegador. Para
              compartirlos, publica el script de <code>google-apps-script/Codigo.gs</code>
              como aplicación web desde la propia planilla y define
              <code> VITE_SHEETS_API_URL</code> y <code>VITE_SHEETS_TOKEN</code>.
              Los pasos están en el README.
            </p>
          )}
          <div className="btn-group">
            <button className="btn btn-secondary" onClick={respaldar}>💾 Descargar respaldo</button>
            <button className="btn btn-secondary" onClick={() => inputRef.current?.click()}>📂 Importar convenios</button>
            <button className="btn btn-danger" onClick={onBorrarConvenios} disabled={convenios.length === 0}>🗑️ Borrar todos los convenios</button>
            <input type="file" accept="application/json,.json" ref={inputRef} style={{ display: 'none' }} onChange={importar} />
          </div>
          {mensaje && <p className="ayuda-campo">{mensaje}</p>}
        </div>

        <div className="section">
          <h3 className="section-title">Datos de ejemplo</h3>
          <p className="nota-seccion">
            Carga 8 convenios y 4 solicitudes ficticios para recorrer el sistema con
            algo que mirar: cubren todos los estados del semáforo y todas las unidades
            del flujo. Las fechas se calculan respecto de hoy, así que los ejemplos
            nunca quedan obsoletos.
          </p>
          <p className="nota-seccion">
            <strong>No son datos reales.</strong> Se identifican por el prefijo
            <code> EJ-</code> en su código y por un aviso en sus observaciones, y se
            pueden quitar después sin afectar los convenios que hayas registrado.
          </p>
          <table className="tabla-plazos">
            <tbody>
              <tr><th>Registros de ejemplo cargados</th><td>{ejemplos}</td></tr>
            </tbody>
          </table>
          <div className="btn-group">
            <button className="btn btn-secondary" onClick={onCargarEjemplos}>🧪 Cargar datos de ejemplo</button>
            <button className="btn btn-danger" onClick={onBorrarEjemplos} disabled={ejemplos === 0}>
              🧹 Quitar datos de ejemplo
            </button>
          </div>
        </div>

        <div className="section">
          <h3 className="section-title">Google Calendar</h3>
          <table className="tabla-plazos">
            <tbody>
              <tr><th>Exportación .ics</th><td>Disponible</td></tr>
              <tr><th>Enlaces &quot;Agregar a Google&quot;</th><td>Disponible</td></tr>
              <tr><th>Sincronización automática</th><td>{integracion.configurado ? 'Credenciales presentes, adaptador pendiente' : 'No configurada'}</td></tr>
              <tr><th>Calendario destino</th><td>{integracion.calendarId || '—'}</td></tr>
            </tbody>
          </table>
          <p className="nota-seccion">{integracion.detalle}</p>
        </div>
      </div>

      <div className="detail-sections">
        <div className="section">
          <h3 className="section-title">Flujo y unidades</h3>
          <p className="nota-seccion">
            Flujo sugerido: {['Ingresado', ...FLUJO_POR_DEFECTO.map(id => UNIDADES.find(u => u.id === id)?.nombre || id), 'Finalizado'].join(' → ')}.
            Cada convenio puede alterarlo desde su ficha.
          </p>
          <table className="tabla-plazos">
            <tbody>
              {UNIDADES.map(u => (
                <tr key={u.id}><th>{u.nombre}</th><td>{u.descripcion}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="nota-seccion">
            Para agregar o renombrar unidades, edita <code>UNIDADES</code> en
            <code> src/config/convenios.js</code>: el resto de la aplicación (dashboard,
            seguimiento, reportes) se actualiza solo.
          </p>
        </div>

        <div className="section">
          <h3 className="section-title">Reglas de plazos</h3>
          <table className="tabla-plazos">
            <tbody>
              <tr><th>Plazo general de convenios</th><td>No existe: se atiende por orden de llegada</td></tr>
              <tr><th>Alerta &quot;próximo a vencer&quot;</th><td>{DIAS_ALERTA_VENCIMIENTO} días corridos antes de la fecha límite</td></tr>
              {Object.entries(PLAZOS_LEY_20285).map(([clave, p]) => (
                <tr key={clave}>
                  <th>{clave.replace(/_/g, ' ').toLowerCase()} (Ley 20.285)</th>
                  <td>{p.dias} días hábiles — {p.articulo}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="leyenda-plazos" style={{ marginTop: '0.75rem' }}>
            {Object.entries(SEMAFORO).map(([key, s]) => (
              <span key={key} className={`plazo-badge ${s.clase}`}>
                <span className="plazo-badge-icono" aria-hidden="true">{s.icono}</span>{s.label}
              </span>
            ))}
          </div>
          <table className="tabla-plazos" style={{ marginTop: '0.75rem' }}>
            <tbody>
              <tr>
                <th>Feriados cargados hasta</th>
                <td>{anioLimite || '—'}</td>
              </tr>
              <tr>
                <th>Próximos feriados</th>
                <td>{feriados.join(', ') || 'Sin feriados próximos en la tabla'}</td>
              </tr>
            </tbody>
          </table>
          {faltanFeriados && (
            <div className="form-error" style={{ marginTop: '0.75rem' }} role="alert">
              ⚠️ La tabla de feriados llega hasta el {anioLimite}. Desde el {anioLimite + 1} los
              plazos de la Ley 20.285 se calculan contando los feriados que falten como días
              hábiles, así que quedan <strong>antes</strong> de la fecha real. Las solicitudes
              afectadas aparecen marcadas con ⚠️ en Transparencia pasiva.
            </div>
          )}
          <p className="nota-seccion">
            Para extender el cálculo, agrega los feriados del año siguiente a{' '}
            <code>src/config/feriados.js</code> y vuelve a desplegar. Ojo con los movibles
            (Viernes Santo, San Pedro y San Pablo, Encuentro de Dos Mundos, Iglesias
            Evangélicas) y con los feriados de elecciones, que cambian de fecha cada año.
          </p>
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">Valores admitidos</h3>
        <table className="tabla-plazos">
          <tbody>
            <tr><th>Estados de convenio</th><td>{ESTADOS_CONVENIO.join(' · ')}</td></tr>
            <tr><th>Estados de etapa</th><td>{ESTADOS_ETAPA.join(' · ')}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

ConfiguracionView.propTypes = {
  convenios: PropTypes.array.isRequired,
  solicitudes: PropTypes.array.isRequired,
  dbMode: PropTypes.string.isRequired,
  cargando: PropTypes.bool,
  onRecargar: PropTypes.func.isRequired,
  onFalloRemoto: PropTypes.func.isRequired,
  onImportarConvenios: PropTypes.func.isRequired,
  onBorrarConvenios: PropTypes.func.isRequired,
  onCargarEjemplos: PropTypes.func.isRequired,
  onBorrarEjemplos: PropTypes.func.isRequired,
};
