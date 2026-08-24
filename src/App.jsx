import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import { normalizarConvenio, TIPOS_HISTORIAL } from './config/convenios';
import { conHistorial, crearEvento, FILTROS_VACIOS, hayFiltrosAvanzados } from './utils/conveniosLogic';
import { leerLocal, guardarLocal, siguienteIdLocal } from './config/conveniosStore';
import { leerSolicitudesLocal, guardarSolicitudesLocal, siguienteIdSolicitud } from './config/transparenciaStore';
import {
  sheetsConfigurado, fetchTodo,
  crearConvenioRemoto, actualizarConvenioRemoto, eliminarConvenioRemoto,
  crearSolicitudRemota, actualizarSolicitudRemota, eliminarSolicitudRemota,
} from './config/sheetsStore';
import { normalizarSolicitud } from './config/transparencia';
import { MODO, calcularModo, usaPlanilla, permiteEscribir, mensajeSinConexion } from './config/modoDatos';
import { crearLoteRemoto, eliminarLoteRemoto, avisoLote, huboRechazoDeAcceso } from './config/sincronizacion';
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

// Punto de partida del listado de convenios: sin filtros, por orden de llegada
// (regla de negocio N°1) y con el panel de fechas cerrado.
const LISTA_CONVENIOS_INICIAL = { filtros: FILTROS_VACIOS, orden: 'llegada', avanzados: false };

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
  // El estado del listado de convenios (filtros, orden y panel de fechas) vive
  // acá y no dentro de ConveniosList por dos razones opuestas:
  //
  //   · La lista se desmonta al abrir una ficha, así que lo que la persona
  //     hubiera filtrado o buscado se perdía al volver del detalle.
  //   · Y al revés: el filtro que llegaba desde una tarjeta del dashboard se
  //     quedaba pegado y volvía a aplicarse al entrar por el menú lateral, sin
  //     que nada explicara por qué la lista aparecía recortada.
  //
  // Teniéndolo acá, cada navegación decide explícitamente si lo conserva.
  const [listaConvenios, setListaConvenios] = useState(LISTA_CONVENIOS_INICIAL);
  // Convenios y solicitudes viven en Google Sheets; localStorage es el respaldo.
  //
  // "La planilla no responde" es un estado transitorio, no otra forma de
  // trabajar: se sale de él reintentando. Por eso se guarda aparte de si la
  // planilla está configurada, y el modo se deriva de las dos cosas.
  const [planillaCaida, setPlanillaCaida] = useState(false);
  const [cargando, setCargando] = useState(false);
  const modoDatos = calcularModo(sheetsConfigurado(), planillaCaida);
  const [toast, setToast] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Limpieza de los restos del acceso por contraseña de versiones anteriores.
  useEffect(() => {
    ['umag_saved_pass', 'umag_saved_user', 'umag_remember'].forEach(k => localStorage.removeItem(k));
    sessionStorage.removeItem('umag_auth');
    sessionStorage.removeItem('umag_user');
  }, []);

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

  /**
   * Trae convenios y solicitudes desde la planilla.
   *
   * Se usa al entrar y también desde el botón "Reintentar"/"Actualizar": que
   * la planilla se haya caído una vez no puede dejar a la app en modo local
   * para siempre, que era lo que pasaba antes.
   *
   * Si falla se conserva lo que haya en localStorage —así se puede seguir
   * consultando— pero la app queda en 'sin-conexion' y no deja escribir.
   */
  const recargarDatos = async ({ silencioso = false } = {}) => {
    if (!sheetsConfigurado() || !sesion) return false;
    setCargando(true);
    try {
      const { data, error, noAutorizado } = await fetchTodo();
      if (data) {
        setConvenios(data.convenios.map(normalizarConvenio).filter(Boolean));
        setSolicitudes(data.solicitudes.map(normalizarSolicitud).filter(Boolean));
        setPlanillaCaida(false);
        if (!silencioso) setToast({ type: 'success', message: 'Datos actualizados desde la planilla' });
        return true;
      }
      if (noAutorizado) {
        manejarNoAutorizado(error);
        return false;
      }
      setPlanillaCaida(true);
      setToast({
        type: 'error',
        message: `No se pudo leer la planilla (${error}). Puedes consultar la copia local, `
          + 'pero no registrar cambios hasta recuperar la conexión.',
      });
      return false;
    } catch (e) {
      setPlanillaCaida(true);
      console.warn('Error cargando desde la planilla:', e.message);
      return false;
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { recargarDatos({ silencioso: true }); }, [sesion]);

  // Respaldo local (también cuando se usa la planilla)
  useEffect(() => { guardarLocal(convenios); }, [convenios]);
  useEffect(() => { guardarSolicitudesLocal(solicitudes); }, [solicitudes]);

  /**
   * Guardia de escritura. Sin conexión con la planilla no se escribe nada:
   * un registro guardado sólo en local llevaría un id inventado que la
   * planilla no conoce, y la siguiente carga exitosa se lo llevaría por
   * delante después de haber dicho "guardado ✓".
   */
  const bloqueadoSinConexion = (accion) => {
    if (permiteEscribir(modoDatos)) return false;
    setToast({ type: 'error', message: mensajeSinConexion(accion) });
    return true;
  };

  // Un fallo de escritura contra la planilla la marca como caída, salvo que sea
  // un rechazo de identidad (eso se resuelve volviendo a entrar, no reintentando).
  const registrarFalloRemoto = ({ noAutorizado, error }) => {
    if (noAutorizado) manejarNoAutorizado(error);
    else setPlanillaCaida(true);
  };

  // En un lote basta con que UNO de los fallos sea por identidad para que haya
  // que volver a entrar: mirar sólo el primero dejaría pasar el caso en que la
  // sesión caduca a mitad del recorrido.
  const registrarFallosDeLote = (fallidos = []) => {
    if (fallidos.length === 0) return;
    const rechazo = huboRechazoDeAcceso(fallidos) ? fallidos.find(f => f.noAutorizado) : null;
    registrarFalloRemoto(rechazo || fallidos[0]);
  };

  /* ---------------- Convenios institucionales ---------------- */

  // El historial guarda el correo verificado por Google: es la identidad real
  // de quien hizo el cambio, no un nombre que alguien escribió a mano.
  const usuarioActual = () => usuario?.email || 'desconocido';

  /**
   * Navegación que REEMPLAZA el estado del listado de convenios.
   *
   * La usan el menú lateral (sin filtros: la lista arranca limpia) y las
   * tarjetas del dashboard (con el filtro de la tarjeta). Volver desde una
   * ficha no pasa por acá justamente para conservar lo que hubiera filtrado.
   */
  const irA = (vista, filtros = null) => {
    if (vista === 'convenios') {
      const aplicados = { ...FILTROS_VACIOS, ...(filtros || {}) };
      setListaConvenios({
        ...LISTA_CONVENIOS_INICIAL,
        filtros: aplicados,
        // El panel de fechas se abre sólo si el filtro que llega está adentro:
        // recortar la lista con un criterio invisible es lo que confundía.
        avanzados: hayFiltrosAvanzados(aplicados),
      });
    }
    setActiveView(vista);
  };

  const handleSelectConvenio = (convenio) => {
    setSelectedConvenio(convenio);
    setActiveView("convenio-detalle");
  };

  const handleCrearConvenio = async (nuevo) => {
    if (bloqueadoSinConexion('crear el convenio')) return;
    // El historial arranca con el ingreso, para que la trazabilidad esté
    // completa desde el primer día.
    const conEventoInicial = {
      ...nuevo,
      historial: [crearEvento(TIPOS_HISTORIAL.CREACION, 'Convenio ingresado al sistema', usuarioActual())],
    };
    if (usaPlanilla(modoDatos)) {
      // El id lo asigna la planilla, para que dos personas no lo generen igual.
      const respuesta = await crearConvenioRemoto(conEventoInicial);
      const { ok, datos, error } = respuesta;
      if (!ok) {
        registrarFalloRemoto(respuesta);
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
    if (bloqueadoSinConexion('guardar el convenio')) return;
    const anterior = convenios.find(c => c.id === actualizado.id) || null;
    // conHistorial compara ambas versiones y anota cada cambio relevante.
    const conTraza = normalizarConvenio(conHistorial(anterior, actualizado, usuarioActual()));
    setConvenios(prev => prev.map(c => c.id === conTraza.id ? conTraza : c));
    setSelectedConvenio(conTraza);
    if (usaPlanilla(modoDatos)) {
      const respuesta = await actualizarConvenioRemoto(conTraza);
      const { ok, error } = respuesta;
      if (!ok) {
        registrarFalloRemoto(respuesta);
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
    if (bloqueadoSinConexion('eliminar el convenio')) return;
    if (!window.confirm(`¿Eliminar el convenio "${selectedConvenio.nombre}"? Esta acción no se puede deshacer.`)) return;
    if (usaPlanilla(modoDatos)) {
      const respuesta = await eliminarConvenioRemoto(selectedConvenio.id);
      const { ok, error } = respuesta;
      if (!ok) {
        registrarFalloRemoto(respuesta);
        setToast({ type: 'error', message: `Error al eliminar el convenio en la planilla (${error}).` });
        return;
      }
    }
    setConvenios(prev => prev.filter(c => c.id !== selectedConvenio.id));
    setSelectedConvenio(null);
    setActiveView("convenios");
    setToast({ type: 'success', message: 'Convenio eliminado' });
  };

  // Importación de respaldo: los convenios entrantes se agregan como nuevos,
  // sin pisar los existentes.
  //
  // Con planilla configurada tienen que crearse ALLÁ. Antes se agregaban sólo
  // al estado y a localStorage, así que la importación desaparecía en la
  // siguiente carga después de haber avisado "importados ✓".
  const handleImportarConvenios = async (importados) => {
    if (bloqueadoSinConexion('importar los convenios')) return;

    if (usaPlanilla(modoDatos)) {
      // El id lo asigna la planilla, así que se descarta el que traiga el archivo.
      const sinId = importados.map(({ id, ...resto }) => resto); // eslint-disable-line no-unused-vars
      const { creados, fallidos } = await crearLoteRemoto(sinId, crearConvenioRemoto, normalizarConvenio);
      if (creados.length > 0) setConvenios(prev => [...prev, ...creados]);
      registrarFallosDeLote(fallidos);
      setToast(avisoLote(creados, fallidos, 'importados', 'convenio'));
      return;
    }

    setConvenios(prev => {
      let siguiente = siguienteIdLocal(prev);
      const nuevos = importados.map(c => normalizarConvenio({ ...c, id: siguiente++ }));
      return [...prev, ...nuevos];
    });
    setToast({ type: 'success', message: `${importados.length} convenio(s) importados` });
  };

  // Igual que la importación: con planilla configurada hay que borrar allá.
  // Vaciar sólo la pantalla daba un "eliminados ✓" que la siguiente carga
  // desmentía trayendo todo de vuelta.
  const handleBorrarConvenios = async () => {
    if (bloqueadoSinConexion('borrar los convenios')) return;
    if (convenios.length === 0) return;
    if (!window.confirm('¿Borrar TODOS los convenios registrados? Esta acción no se puede deshacer. Descarga un respaldo antes de continuar.')) return;

    if (usaPlanilla(modoDatos)) {
      const { eliminados, fallidos } = await eliminarLoteRemoto(convenios, eliminarConvenioRemoto);
      // Sólo desaparecen de la pantalla los que la planilla dio por borrados.
      const borrados = new Set(eliminados.map(c => c.id));
      setConvenios(prev => prev.filter(c => !borrados.has(c.id)));
      if (selectedConvenio && borrados.has(selectedConvenio.id)) setSelectedConvenio(null);
      registrarFallosDeLote(fallidos);
      setToast(avisoLote(eliminados, fallidos, 'eliminados', 'convenio'));
      return;
    }

    setConvenios([]);
    setSelectedConvenio(null);
    setToast({ type: 'success', message: 'Convenios eliminados' });
  };

  /* ---------------------- Datos de ejemplo ---------------------- */

  // Los ejemplos NO se cargan solos: se piden desde Configuración, para que la
  // app arranque vacía y nunca se confundan con convenios reales.
  const handleCargarEjemplos = async () => {
    if (bloqueadoSinConexion('cargar los datos de ejemplo')) return;
    const yaHay = convenios.some(esRegistroEjemplo) || solicitudes.some(esRegistroEjemplo);
    const aviso = yaHay
      ? 'Ya hay datos de ejemplo cargados. Se agregará otra copia. ¿Continuar?'
      : 'Se cargarán 8 convenios y 4 solicitudes de ejemplo (ficticios, identificados con el prefijo EJ-). ¿Continuar?';
    if (!window.confirm(aviso)) return;

    const nuevosConvenios = generarConveniosEjemplo();
    const nuevasSolicitudes = generarSolicitudesEjemplo();

    if (usaPlanilla(modoDatos)) {
      // Secuencial a propósito: el Apps Script asigna los ids uno por uno y en
      // paralelo se pisarían entre sí.
      const { creados: convCreados } = await crearLoteRemoto(nuevosConvenios, crearConvenioRemoto, normalizarConvenio);
      const { creados: soliCreadas } = await crearLoteRemoto(nuevasSolicitudes, crearSolicitudRemota, normalizarSolicitud);
      if (convCreados.length === 0 && soliCreadas.length === 0) {
        setPlanillaCaida(true);
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
    if (bloqueadoSinConexion('quitar los datos de ejemplo')) return;
    const conveniosEjemplo = convenios.filter(esRegistroEjemplo);
    const solicitudesEjemplo = solicitudes.filter(esRegistroEjemplo);
    const total = conveniosEjemplo.length + solicitudesEjemplo.length;
    if (total === 0) return;
    if (!window.confirm(`¿Quitar los ${total} registro(s) de ejemplo? Los convenios y solicitudes reales se conservan.`)) return;

    if (usaPlanilla(modoDatos)) {
      // También secuencial: cada borrado desplaza las filas de la planilla.
      const conv = await eliminarLoteRemoto(conveniosEjemplo, eliminarConvenioRemoto);
      const soli = await eliminarLoteRemoto(solicitudesEjemplo, eliminarSolicitudRemota);
      // Sólo se sacan de la pantalla los que la planilla dio por borrados.
      const borrados = new Set(conv.eliminados.map(c => c.id));
      const borradas = new Set(soli.eliminados.map(s => s.id));
      setConvenios(prev => prev.filter(c => !borrados.has(c.id)));
      setSolicitudes(prev => prev.filter(s => !borradas.has(s.id)));
      if (selectedConvenio && borrados.has(selectedConvenio.id)) setSelectedConvenio(null);
      const fallidos = [...conv.fallidos, ...soli.fallidos];
      registrarFallosDeLote(fallidos);
      setToast(avisoLote([...conv.eliminados, ...soli.eliminados], fallidos, 'eliminados', 'registro de ejemplo'));
      return;
    }

    setConvenios(prev => prev.filter(c => !esRegistroEjemplo(c)));
    setSolicitudes(prev => prev.filter(s => !esRegistroEjemplo(s)));
    if (selectedConvenio && esRegistroEjemplo(selectedConvenio)) setSelectedConvenio(null);
    setToast({ type: 'success', message: 'Datos de ejemplo eliminados' });
  };

  /* ------------- Solicitudes de transparencia (Ley 20.285) ------------- */

  const handleCrearSolicitud = async (nueva) => {
    if (bloqueadoSinConexion('crear la solicitud')) return;
    const conEvento = {
      ...nueva,
      historial: [crearEvento(TIPOS_HISTORIAL.CREACION, 'Solicitud ingresada al sistema', usuarioActual())],
    };
    if (usaPlanilla(modoDatos)) {
      const respuesta = await crearSolicitudRemota(conEvento);
      const { ok, datos, error } = respuesta;
      if (!ok) {
        registrarFalloRemoto(respuesta);
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
    if (bloqueadoSinConexion('guardar la solicitud')) return;
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
    if (usaPlanilla(modoDatos)) {
      const respuesta = await actualizarSolicitudRemota(conTraza);
      const { ok, error } = respuesta;
      if (!ok) {
        registrarFalloRemoto(respuesta);
        if (anterior) setSolicitudes(prev => prev.map(s => s.id === anterior.id ? anterior : s));
        setToast({ type: 'error', message: `Error al guardar la solicitud en la planilla (${error}). Se revirtieron los cambios.` });
        return;
      }
    }
    setToast({ type: 'success', message: 'Solicitud guardada' });
  };

  const handleEliminarSolicitud = async (solicitud) => {
    if (!solicitud) return;
    if (bloqueadoSinConexion('eliminar la solicitud')) return;
    if (!window.confirm(`¿Eliminar la solicitud ${solicitud.codigo || solicitud.id}?`)) return;
    if (usaPlanilla(modoDatos)) {
      const respuesta = await eliminarSolicitudRemota(solicitud.id);
      const { ok, error } = respuesta;
      if (!ok) {
        registrarFalloRemoto(respuesta);
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
        <Sidebar activeView={activeView} onViewChange={(view) => { irA(view); setSidebarOpen(false); }} sidebarOpen={sidebarOpen} />
        <div className="content">
          <div className="page-container">
            {modoDatos === MODO.SIN_CONEXION && (
              <div className="aviso-sin-conexion" role="alert">
                <span aria-hidden="true">⚠️</span>
                <div>
                  <strong>Sin conexión con la planilla.</strong> Estás viendo la copia local
                  guardada en este navegador. No se pueden registrar cambios hasta recuperar
                  la conexión, para que nada se guarde y después se pierda.
                </div>
                <button className="btn btn-primary btn-small" onClick={() => recargarDatos()} disabled={cargando}>
                  {cargando ? 'Reintentando…' : 'Reintentar'}
                </button>
              </div>
            )}
            <Suspense fallback={<PageLoader />}>
              {activeView === "conv-dashboard" && (
                <ConveniosDashboard convenios={convenios} onSelectConvenio={handleSelectConvenio} onIrA={irA} />
              )}
              {activeView === "convenios" && (
                <ConveniosList
                  convenios={convenios}
                  estado={listaConvenios}
                  onEstadoChange={setListaConvenios}
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
                  cargando={cargando}
                  onRecargar={recargarDatos}
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
