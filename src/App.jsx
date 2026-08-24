import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import { normalizarConvenio, TIPOS_HISTORIAL } from './config/convenios';
import { conHistorial, crearEvento } from './utils/conveniosLogic';
import { leerLocal, guardarLocal, siguienteIdLocal } from './config/conveniosStore';
import { leerSolicitudesLocal, guardarSolicitudesLocal, siguienteIdSolicitud } from './config/transparenciaStore';
import {
  sheetsConfigurado, fetchTodo,
  crearConvenioRemoto, actualizarConvenioRemoto, eliminarConvenioRemoto,
  crearSolicitudRemota, actualizarSolicitudRemota, eliminarSolicitudRemota,
} from './config/sheetsStore';
import { normalizarSolicitud } from './config/transparencia';
import { generarConveniosEjemplo, generarSolicitudesEjemplo, esRegistroEjemplo } from './config/datosEjemplo';
import {
  googleConfigurado, montarBotonGoogle, guardarSesion, leerSesion,
  cerrarSesion, usuarioDeSesion,
} from './config/auth';

// Lazy loading de páginas — reduce el bundle inicial
const ConveniosDashboard = lazy(() => import('./pages/ConveniosDashboard'));
const ConveniosList = lazy(() => import('./pages/ConveniosList'));
const ConvenioDetail = lazy(() => import('./pages/ConvenioDetail'));
const NuevoConvenio = lazy(() => import('./pages/NuevoConvenio'));
const SeguimientoView = lazy(() => import('./pages/SeguimientoView'));
const CalendarioView = lazy(() => import('./pages/CalendarioView'));
const TransparenciaView = lazy(() => import('./pages/TransparenciaView'));
const ReportesView = lazy(() => import('./pages/ReportesView'));
const ConfiguracionView = lazy(() => import('./pages/ConfiguracionView'));

const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: '#94a3b8' }}>
    <div className="spinner" style={{ width: 24, height: 24, border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: '0.75rem' }}></div>
    Cargando...
  </div>
);

function App() {
  // La sesión es el ID token de Google. Si caducó, leerSesion() devuelve null
  // y la app vuelve sola a la pantalla de acceso.
  const [sesion, setSesion] = useState(() => leerSesion());
  const usuario = usuarioDeSesion(sesion);
  const isLoggedIn = Boolean(sesion);
  const [activeView, setActiveView] = useState("conv-dashboard");
  const [convenios, setConvenios] = useState(() => leerLocal());
  const [solicitudes, setSolicitudes] = useState(() => leerSolicitudesLocal());
  const [selectedConvenio, setSelectedConvenio] = useState(null);
  const [filtrosConvenios, setFiltrosConvenios] = useState(null);
  // Convenios y solicitudes viven en Google Sheets; localStorage es el respaldo.
  const [modoDatos, setModoDatos] = useState(sheetsConfigurado() ? 'sheets' : 'local');
  const [toast, setToast] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Limpieza de los restos del acceso por contraseña de versiones anteriores.
  useEffect(() => {
    ['umag_saved_pass', 'umag_saved_user', 'umag_remember'].forEach(k => localStorage.removeItem(k));
    sessionStorage.removeItem('umag_auth');
    sessionStorage.removeItem('umag_user');
  }, []);

  // Cargar convenios y solicitudes desde la planilla de Google.
  // Si falla, se conserva lo que haya en localStorage y se avisa.
  useEffect(() => {
    if (!sheetsConfigurado() || !sesion) return;
    (async () => {
      const { data, error, noAutorizado } = await fetchTodo();
      if (data) {
        setConvenios(data.convenios.map(normalizarConvenio).filter(Boolean));
        setSolicitudes(data.solicitudes.map(normalizarSolicitud).filter(Boolean));
        setModoDatos('sheets');
      } else if (noAutorizado) {
        manejarNoAutorizado(error);
      } else if (error) {
        setModoDatos('local');
        setToast({ type: 'error', message: `No se pudo leer la planilla (${error}). Usando datos locales.` });
      }
    })().catch(e => {
      setModoDatos('local');
      console.warn('Error cargando desde la planilla:', e.message);
    });
  }, [sesion]);

  // Respaldo local (también cuando se usa la planilla)
  useEffect(() => { guardarLocal(convenios); }, [convenios]);
  useEffect(() => { guardarSolicitudesLocal(solicitudes); }, [solicitudes]);

  const [errorAcceso, setErrorAcceso] = useState('');

  const handleLogin = (idToken) => {
    guardarSesion(idToken);
    setErrorAcceso('');
    setSesion(idToken);
  };

  const handleLogout = () => {
    cerrarSesion();
    setSesion(null);
    setActiveView("conv-dashboard");
  };

  // El Apps Script rechaza a quien no esté en su lista de autorizados. Cuando
  // eso pasa, no sirve reintentar: hay que cerrar la sesión y avisar.
  const manejarNoAutorizado = (error) => {
    cerrarSesion();
    setSesion(null);
    setErrorAcceso(error);
  };

  /* ---------------- Convenios institucionales ---------------- */

  // El historial guarda el correo verificado por Google: es la identidad real
  // de quien hizo el cambio, no un nombre que alguien escribió a mano.
  const usuarioActual = () => usuario?.email || 'desconocido';

  const irA = (vista, filtros = null) => {
    setFiltrosConvenios(filtros);
    setActiveView(vista);
  };

  const handleSelectConvenio = (convenio) => {
    setSelectedConvenio(convenio);
    setActiveView("convenio-detalle");
  };

  const handleCrearConvenio = async (nuevo) => {
    // El historial arranca con el ingreso, para que la trazabilidad esté
    // completa desde el primer día.
    const conEventoInicial = {
      ...nuevo,
      historial: [crearEvento(TIPOS_HISTORIAL.CREACION, 'Convenio ingresado al sistema', usuarioActual())],
    };
    if (modoDatos === 'sheets') {
      // El id lo asigna la planilla, para que dos personas no lo generen igual.
      const { ok, datos, error } = await crearConvenioRemoto(conEventoInicial);
      if (!ok) {
        setToast({ type: 'error', message: `No se pudo crear el convenio en la planilla (${error}).` });
        return;
      }
      const creado = normalizarConvenio({ ...conEventoInicial, ...datos });
      setConvenios(prev => [...prev, creado]);
      setSelectedConvenio(creado);
    } else {
      const creado = normalizarConvenio({ ...conEventoInicial, id: siguienteIdLocal(convenios) });
      setConvenios(prev => [...prev, creado]);
      setSelectedConvenio(creado);
    }
    setActiveView("convenios");
    setToast({ type: 'success', message: 'Convenio registrado' });
  };

  const handleGuardarConvenio = async (actualizado) => {
    const anterior = convenios.find(c => c.id === actualizado.id) || null;
    // conHistorial compara ambas versiones y anota cada cambio relevante.
    const conTraza = normalizarConvenio(conHistorial(anterior, actualizado, usuarioActual()));
    setConvenios(prev => prev.map(c => c.id === conTraza.id ? conTraza : c));
    setSelectedConvenio(conTraza);
    if (modoDatos === 'sheets') {
      const { ok, error } = await actualizarConvenioRemoto(conTraza);
      if (!ok) {
        if (anterior) {
          setConvenios(prev => prev.map(c => c.id === anterior.id ? anterior : c));
          setSelectedConvenio(anterior);
        }
        setToast({ type: 'error', message: `Error al guardar en la planilla (${error}). Se revirtieron los cambios.` });
        return;
      }
    }
    setToast({ type: 'success', message: 'Convenio guardado' });
  };

  const handleEliminarConvenio = async () => {
    if (!selectedConvenio) return;
    if (!window.confirm(`¿Eliminar el convenio "${selectedConvenio.nombre}"? Esta acción no se puede deshacer.`)) return;
    if (modoDatos === 'sheets') {
      const { ok, error } = await eliminarConvenioRemoto(selectedConvenio.id);
      if (!ok) {
        setToast({ type: 'error', message: `Error al eliminar el convenio en la planilla (${error}).` });
        return;
      }
    }
    setConvenios(prev => prev.filter(c => c.id !== selectedConvenio.id));
    setSelectedConvenio(null);
    setActiveView("convenios");
    setToast({ type: 'success', message: 'Convenio eliminado' });
  };

  // Importación de respaldo: los convenios entrantes se agregan con IDs nuevos
  // para no pisar los existentes.
  const handleImportarConvenios = (importados) => {
    setConvenios(prev => {
      let siguiente = siguienteIdLocal(prev);
      const nuevos = importados.map(c => normalizarConvenio({ ...c, id: siguiente++ }));
      return [...prev, ...nuevos];
    });
    setToast({ type: 'success', message: `${importados.length} convenio(s) importados` });
  };

  const handleBorrarConvenios = () => {
    if (!window.confirm('¿Borrar TODOS los convenios registrados? Esta acción no se puede deshacer. Descarga un respaldo antes de continuar.')) return;
    setConvenios([]);
    setSelectedConvenio(null);
    setToast({ type: 'success', message: 'Convenios eliminados' });
  };

  /* ---------------------- Datos de ejemplo ---------------------- */

  // Los ejemplos NO se cargan solos: se piden desde Configuración, para que la
  // app arranque vacía y nunca se confundan con convenios reales.
  const handleCargarEjemplos = async () => {
    const yaHay = convenios.some(esRegistroEjemplo) || solicitudes.some(esRegistroEjemplo);
    const aviso = yaHay
      ? 'Ya hay datos de ejemplo cargados. Se agregará otra copia. ¿Continuar?'
      : 'Se cargarán 8 convenios y 4 solicitudes de ejemplo (ficticios, identificados con el prefijo EJ-). ¿Continuar?';
    if (!window.confirm(aviso)) return;

    const nuevosConvenios = generarConveniosEjemplo();
    const nuevasSolicitudes = generarSolicitudesEjemplo();

    if (modoDatos === 'sheets') {
      // Secuencial a propósito: el Apps Script asigna los ids uno por uno y en
      // paralelo se pisarían entre sí.
      const convCreados = [];
      for (const c of nuevosConvenios) {
        const { ok, datos } = await crearConvenioRemoto(c);
        if (ok) convCreados.push(normalizarConvenio({ ...c, ...datos }));
      }
      const soliCreadas = [];
      for (const s of nuevasSolicitudes) {
        const { ok, datos } = await crearSolicitudRemota(s);
        if (ok) soliCreadas.push(normalizarSolicitud({ ...s, ...datos }));
      }
      if (convCreados.length === 0 && soliCreadas.length === 0) {
        setToast({ type: 'error', message: 'No se pudieron cargar los datos de ejemplo en la planilla.' });
        return;
      }
      setConvenios(prev => [...prev, ...convCreados]);
      setSolicitudes(prev => [...prev, ...soliCreadas]);
      setToast({ type: 'success', message: `Cargados ${convCreados.length} convenios y ${soliCreadas.length} solicitudes de ejemplo` });
      return;
    }

    // En modo local hay que reasignar los IDs para no pisar los ya existentes.
    setConvenios(prev => {
      let siguiente = siguienteIdLocal(prev);
      return [...prev, ...nuevosConvenios.map(c => normalizarConvenio({ ...c, id: siguiente++ }))];
    });
    setSolicitudes(prev => {
      let siguiente = siguienteIdSolicitud(prev);
      return [...prev, ...nuevasSolicitudes.map(s => normalizarSolicitud({ ...s, id: siguiente++ }))];
    });
    setToast({ type: 'success', message: `Cargados ${nuevosConvenios.length} convenios y ${nuevasSolicitudes.length} solicitudes de ejemplo` });
  };

  const handleBorrarEjemplos = async () => {
    const conveniosEjemplo = convenios.filter(esRegistroEjemplo);
    const solicitudesEjemplo = solicitudes.filter(esRegistroEjemplo);
    const total = conveniosEjemplo.length + solicitudesEjemplo.length;
    if (total === 0) return;
    if (!window.confirm(`¿Quitar los ${total} registro(s) de ejemplo? Los convenios y solicitudes reales se conservan.`)) return;

    if (modoDatos === 'sheets') {
      // También secuencial: cada borrado desplaza las filas de la planilla.
      for (const c of conveniosEjemplo) await eliminarConvenioRemoto(c.id);
      for (const s of solicitudesEjemplo) await eliminarSolicitudRemota(s.id);
    }
    setConvenios(prev => prev.filter(c => !esRegistroEjemplo(c)));
    setSolicitudes(prev => prev.filter(s => !esRegistroEjemplo(s)));
    if (selectedConvenio && esRegistroEjemplo(selectedConvenio)) setSelectedConvenio(null);
    setToast({ type: 'success', message: 'Datos de ejemplo eliminados' });
  };

  /* ------------- Solicitudes de transparencia (Ley 20.285) ------------- */

  const handleCrearSolicitud = async (nueva) => {
    const conEvento = {
      ...nueva,
      historial: [crearEvento(TIPOS_HISTORIAL.CREACION, 'Solicitud ingresada al sistema', usuarioActual())],
    };
    if (modoDatos === 'sheets') {
      const { ok, datos, error } = await crearSolicitudRemota(conEvento);
      if (!ok) {
        setToast({ type: 'error', message: `No se pudo crear la solicitud en la planilla (${error}).` });
        return;
      }
      setSolicitudes(prev => [...prev, normalizarSolicitud({ ...conEvento, ...datos })]);
    } else {
      setSolicitudes(prev => [...prev, normalizarSolicitud({ ...conEvento, id: siguienteIdSolicitud(prev) })]);
    }
    setToast({ type: 'success', message: 'Solicitud registrada' });
  };

  const handleGuardarSolicitud = async (actualizada) => {
    const anterior = solicitudes.find(s => s.id === actualizada.id) || null;
    const eventos = [];
    if (anterior && anterior.estado !== actualizada.estado) {
      eventos.push(crearEvento(TIPOS_HISTORIAL.ESTADO, `Estado: ${anterior.estado} → ${actualizada.estado}`, usuarioActual()));
    }
    if (anterior && !anterior.prorrogada && actualizada.prorrogada) {
      eventos.push(crearEvento(TIPOS_HISTORIAL.PLAZO, 'Prórroga de 10 días hábiles comunicada (Art. 14)', usuarioActual()));
    }
    if (anterior && !anterior.fechaRespuesta && actualizada.fechaRespuesta) {
      eventos.push(crearEvento(TIPOS_HISTORIAL.FINALIZACION, `Respuesta enviada el ${actualizada.fechaRespuesta}`, usuarioActual()));
    }
    const conTraza = normalizarSolicitud({
      ...actualizada,
      historial: [...(actualizada.historial || []), ...eventos],
    });
    setSolicitudes(prev => prev.map(s => s.id === conTraza.id ? conTraza : s));
    if (modoDatos === 'sheets') {
      const { ok, error } = await actualizarSolicitudRemota(conTraza);
      if (!ok) {
        if (anterior) setSolicitudes(prev => prev.map(s => s.id === anterior.id ? anterior : s));
        setToast({ type: 'error', message: `Error al guardar la solicitud en la planilla (${error}). Se revirtieron los cambios.` });
        return;
      }
    }
    setToast({ type: 'success', message: 'Solicitud guardada' });
  };

  const handleEliminarSolicitud = async (solicitud) => {
    if (!solicitud) return;
    if (!window.confirm(`¿Eliminar la solicitud ${solicitud.codigo || solicitud.id}?`)) return;
    if (modoDatos === 'sheets') {
      const { ok, error } = await eliminarSolicitudRemota(solicitud.id);
      if (!ok) {
        setToast({ type: 'error', message: `Error al eliminar la solicitud en la planilla (${error}).` });
        return;
      }
    }
    setSolicitudes(prev => prev.filter(s => s.id !== solicitud.id));
    setToast({ type: 'success', message: 'Solicitud eliminada' });
  };

  if (!isLoggedIn) {
    return <PantallaAcceso onLogin={handleLogin} error={errorAcceso} />;
  }

  return (
    <div className="app-wrapper">
      <Header userName={usuario?.nombre || usuario?.email || "Usuario"} onLogout={handleLogout} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="app-body">
        <div className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)}></div>
        <Sidebar activeView={activeView} onViewChange={(view) => { setActiveView(view); setSidebarOpen(false); }} sidebarOpen={sidebarOpen} />
        <div className="content">
          <div className="page-container">
            <Suspense fallback={<PageLoader />}>
              {activeView === "conv-dashboard" && (
                <ConveniosDashboard convenios={convenios} onSelectConvenio={handleSelectConvenio} onIrA={irA} />
              )}
              {activeView === "convenios" && (
                <ConveniosList
                  convenios={convenios}
                  filtrosIniciales={filtrosConvenios}
                  onSelectConvenio={handleSelectConvenio}
                  onNuevo={() => setActiveView("convenio-nuevo")}
                />
              )}
              {activeView === "convenio-detalle" && (selectedConvenio ? (
                <ConvenioDetail
                  convenio={selectedConvenio}
                  onBack={() => setActiveView("convenios")}
                  onSave={handleGuardarConvenio}
                  onDelete={handleEliminarConvenio}
                />
              ) : (
                <div className="page-content">
                  <p style={{ color: '#94a3b8' }}>Selecciona un convenio desde el listado.</p>
                  <button className="btn btn-secondary" onClick={() => setActiveView("convenios")}>Ir a Convenios</button>
                </div>
              ))}
              {activeView === "convenio-nuevo" && (
                <NuevoConvenio onCrear={handleCrearConvenio} onCancelar={() => setActiveView("convenios")} />
              )}
              {activeView === "seguimiento" && (
                <SeguimientoView convenios={convenios} onSelectConvenio={handleSelectConvenio} />
              )}
              {activeView === "calendario" && (
                <CalendarioView convenios={convenios} solicitudes={solicitudes} onSelectConvenio={handleSelectConvenio} />
              )}
              {activeView === "transparencia" && (
                <TransparenciaView
                  solicitudes={solicitudes}
                  onCrear={handleCrearSolicitud}
                  onGuardar={handleGuardarSolicitud}
                  onEliminar={handleEliminarSolicitud}
                />
              )}
              {activeView === "reportes" && <ReportesView convenios={convenios} solicitudes={solicitudes} />}
              {activeView === "configuracion" && (
                <ConfiguracionView
                  convenios={convenios}
                  solicitudes={solicitudes}
                  dbMode={modoDatos}
                  onImportarConvenios={handleImportarConvenios}
                  onBorrarConvenios={handleBorrarConvenios}
                  onCargarEjemplos={handleCargarEjemplos}
                  onBorrarEjemplos={handleBorrarEjemplos}
                />
              )}
            </Suspense>
          </div>
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

/**
 * Pantalla de acceso. El botón lo dibuja Google, así que hay que montarlo
 * sobre un nodo real del DOM una vez que la librería cargó.
 */
function PantallaAcceso({ onLogin, error }) {
  const contenedorBoton = useRef(null);
  const [errorCarga, setErrorCarga] = useState('');

  useEffect(() => {
    if (!googleConfigurado() || !contenedorBoton.current) return;
    let vigente = true;
    montarBotonGoogle(contenedorBoton.current, (idToken) => {
      if (vigente) onLogin(idToken);
    }).catch(e => { if (vigente) setErrorCarga(e.message); });
    return () => { vigente = false; };
  }, [onLogin]);

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        </div>
        <h2 className="login-title">UMAG</h2>
        <p className="login-subtitle">Transparencia</p>

        {googleConfigurado() ? (
          <>
            <div ref={contenedorBoton} className="login-google"></div>
            <p className="login-nota">
              El acceso está restringido a las cuentas autorizadas.
            </p>
          </>
        ) : (
          <div className="login-error">
            Falta configurar <code>VITE_GOOGLE_CLIENT_ID</code>. Sin ese dato no
            es posible iniciar sesión. Revisa las variables de entorno en Netlify.
          </div>
        )}

        {error && <div className="login-error">{error}</div>}
        {errorCarga && <div className="login-error">{errorCarga}</div>}
      </div>
    </div>
  );
}


export default App;
