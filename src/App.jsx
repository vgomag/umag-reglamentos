import React, { useState, useEffect, lazy, Suspense } from 'react';
import { INITIAL_REGULATIONS } from './config/data';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import { supabase, supabaseSeedIfEmpty, supabaseFetchAll, supabaseUpsert, supabaseDelete, supabaseInsert } from './config/supabase';
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

// Lazy loading de páginas — reduce bundle inicial ~40%
const ResumenEjecutivo = lazy(() => import('./pages/ResumenEjecutivo'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const RegulationsList = lazy(() => import('./pages/RegulationsList'));
const RegulationDetail = lazy(() => import('./pages/RegulationDetail'));
const NewRegulation = lazy(() => import('./pages/NewRegulation'));
const GanttView = lazy(() => import('./pages/GanttView'));
const DocumentosView = lazy(() => import('./pages/DocumentosView'));
const PlazosList = lazy(() => import('./pages/PlazosList'));
const Normativa = lazy(() => import('./pages/Normativa'));

// Módulo de Transparencia y Convenios
const ConveniosDashboard = lazy(() => import('./pages/ConveniosDashboard'));
const ConveniosList = lazy(() => import('./pages/ConveniosList'));
const ConvenioDetail = lazy(() => import('./pages/ConvenioDetail'));
const NuevoConvenio = lazy(() => import('./pages/NuevoConvenio'));
const SeguimientoView = lazy(() => import('./pages/SeguimientoView'));
const CalendarioView = lazy(() => import('./pages/CalendarioView'));
const TransparenciaView = lazy(() => import('./pages/TransparenciaView'));
const ReportesView = lazy(() => import('./pages/ReportesView'));
const ConfiguracionView = lazy(() => import('./pages/ConfiguracionView'));

// Fallback de carga
const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: '#94a3b8' }}>
    <div className="spinner" style={{ width: 24, height: 24, border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: '0.75rem' }}></div>
    Cargando...
  </div>
);

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => sessionStorage.getItem("umag_auth") === "true");
  const [regulations, setRegulations] = useState(() => {
    try {
      const saved = localStorage.getItem("regulations");
      return saved ? JSON.parse(saved) : INITIAL_REGULATIONS;
    } catch (e) {
      console.error("Error al leer regulations de localStorage:", e);
      return INITIAL_REGULATIONS;
    }
  });
  // La app abre en el panel de convenios: es la tarea diaria del encargado.
  const [activeView, setActiveView] = useState("conv-dashboard");
  const [selectedRegulation, setSelectedRegulation] = useState(null);
  // Convenios y solicitudes de transparencia (módulo nuevo)
  const [convenios, setConvenios] = useState(() => leerLocal());
  const [solicitudes, setSolicitudes] = useState(() => leerSolicitudesLocal());
  const [selectedConvenio, setSelectedConvenio] = useState(null);
  const [filtrosConvenios, setFiltrosConvenios] = useState(null);
  // Convenios y solicitudes viven en Google Sheets; localStorage es el respaldo.
  const [modoDatos, setModoDatos] = useState(sheetsConfigurado() ? 'sheets' : 'local');
  const [toast, setToast] = useState(null);
  const [dbMode, setDbMode] = useState(supabase ? 'supabase' : 'local');
  const [isLoading, setIsLoading] = useState(!!supabase);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [normativas, setNormativas] = useState(() => {
    try {
      const saved = localStorage.getItem('umag_normativas');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Error al leer normativas de localStorage:", e);
      return [];
    }
  });

  // Limpieza única de cualquier contraseña guardada por versiones previas de la app
  useEffect(() => {
    if (localStorage.getItem("umag_saved_pass") !== null) {
      localStorage.removeItem("umag_saved_pass");
    }
  }, []);

  // Cargar datos desde Supabase al inicio
  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const seedResult = await supabaseSeedIfEmpty(INITIAL_REGULATIONS);
      if (seedResult.error) {
        setToast({ type: 'error', message: `No se pudo sembrar la BD: ${seedResult.error}` });
      }
      const { data, error } = await supabaseFetchAll();
      if (data) {
        setRegulations(data);
        setDbMode('supabase');
      } else {
        setDbMode('local');
        if (error) {
          setToast({ type: 'error', message: `Conexión a BD falló (${error}). Usando datos locales.` });
        }
      }
      setIsLoading(false);
    })().catch(e => {
      console.warn('Error inicializando Supabase:', e.message);
      setDbMode('local');
      setIsLoading(false);
      setToast({ type: 'error', message: `Error inicializando BD: ${e.message}. Usando datos locales.` });
    });
  }, []);

  // Cargar convenios y solicitudes desde la planilla de Google.
  // Si falla, se conserva lo que haya en localStorage y se avisa.
  useEffect(() => {
    if (!sheetsConfigurado()) return;
    (async () => {
      const { data, error } = await fetchTodo();
      if (data) {
        setConvenios(data.convenios.map(normalizarConvenio).filter(Boolean));
        setSolicitudes(data.solicitudes.map(normalizarSolicitud).filter(Boolean));
        setModoDatos('sheets');
      } else if (error) {
        setModoDatos('local');
        setToast({ type: 'error', message: `No se pudo leer la planilla (${error}). Usando datos locales.` });
      }
    })().catch(e => {
      setModoDatos('local');
      console.warn('Error cargando desde la planilla:', e.message);
    });
  }, []);

  // Sincronizar con localStorage como backup
  useEffect(() => {
    try { localStorage.setItem("regulations", JSON.stringify(regulations)); }
    catch (e) { console.warn('No se pudo guardar en localStorage:', e.message); }
  }, [regulations]);

  // Respaldo local de convenios y solicitudes (también cuando se usa Supabase)
  useEffect(() => { guardarLocal(convenios); }, [convenios]);
  useEffect(() => { guardarSolicitudesLocal(solicitudes); }, [solicitudes]);

  // Persist normativas to localStorage
  useEffect(() => {
    try { localStorage.setItem('umag_normativas', JSON.stringify(normativas)); }
    catch (e) { console.warn('No se pudo guardar normativas en localStorage:', e.message); }
  }, [normativas]);

  const AUTH_PASSWORD = import.meta.env.VITE_AUTH_PASSWORD || 'umag2026';
  const [loginError, setLoginError] = useState('');
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem("umag_remember") === "true");
  const [loginUser, setLoginUser] = useState(() => localStorage.getItem("umag_saved_user") || 'admin');
  const [loginPass, setLoginPass] = useState('');

  const handleLogin = () => {
    if (!loginUser.trim()) {
      setLoginError('Ingresa un nombre de usuario');
      return;
    }
    if (loginPass !== AUTH_PASSWORD) {
      setLoginError('Contraseña incorrecta');
      return;
    }
    setLoginError('');
    // "Recordarme" sólo guarda el usuario y bandera, nunca la contraseña
    if (rememberMe) {
      localStorage.setItem("umag_remember", "true");
      localStorage.setItem("umag_saved_user", loginUser.trim());
    } else {
      localStorage.removeItem("umag_remember");
      localStorage.removeItem("umag_saved_user");
    }
    // Limpiar credenciales legacy que pudieron haberse guardado en versiones previas
    localStorage.removeItem("umag_saved_pass");
    sessionStorage.setItem("umag_auth", "true");
    sessionStorage.setItem("umag_user", loginUser.trim());
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("umag_auth");
    sessionStorage.removeItem("umag_user");
    // Mantenemos el usuario si "Recordarme" está activo, pero nunca la contraseña
    setIsLoggedIn(false);
    setLoginPass('');
    setActiveView("conv-dashboard");
  };

  const handleSelectRegulation = (reg) => {
    setSelectedRegulation(reg);
    setActiveView("detail");
  };

  const handleSaveRegulation = async (updatedReg) => {
    const previous = regulations.find(r => r.id === updatedReg.id);
    setRegulations(prev => prev.map(r => r.id === updatedReg.id ? updatedReg : r));
    setSelectedRegulation(updatedReg);
    if (dbMode === 'supabase') {
      const ok = await supabaseUpsert(updatedReg);
      if (!ok) {
        // Rollback al estado anterior
        if (previous) setRegulations(prev => prev.map(r => r.id === updatedReg.id ? previous : r));
        setSelectedRegulation(previous || updatedReg);
        setToast({ type: 'error', message: 'Error al guardar en la base de datos. Se revirtieron los cambios.' });
        return;
      }
    }
    setToast({ type: 'success', message: 'Reglamento guardado' });
  };

  const handleDeleteRegulation = async () => {
    if (!selectedRegulation) return;
    if (!window.confirm(`¿Estás seguro de eliminar "${selectedRegulation.nombre}"? Esta acción no se puede deshacer.`)) return;
    if (dbMode === 'supabase') {
      const ok = await supabaseDelete(selectedRegulation.id);
      if (!ok) {
        setToast({ type: 'error', message: 'Error al eliminar en la base de datos. Intenta nuevamente.' });
        return;
      }
    }
    setRegulations(prev => prev.filter(r => r.id !== selectedRegulation.id));
    setActiveView("regulations");
    setSelectedRegulation(null);
    setToast({ type: 'success', message: 'Reglamento eliminado' });
  };

  const handleCreateRegulation = async (newReg) => {
    if (dbMode === 'supabase') {
      const created = await supabaseInsert(newReg);
      if (created) {
        setRegulations(prev => [...prev, created]);
        setActiveView("regulations");
        setToast({ type: 'success', message: 'Reglamento creado' });
        return;
      }
      // Si Supabase falla, NO creamos el registro localmente para evitar IDs
      // duplicados o inconsistencias al reconectarse. Informar al usuario.
      setToast({ type: 'error', message: 'No se pudo crear el reglamento en la base de datos. Inténtalo nuevamente.' });
      return;
    }
    // Modo local: generar ID seguro (basado en el máximo actual)
    const maxId = regulations.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0);
    const id = maxId + 1;
    const created = { ...newReg, id, historial: [], adjuntos: [] };
    setRegulations(prev => [...prev, created]);
    setActiveView("regulations");
    setToast({ type: 'success', message: 'Reglamento creado' });
  };

  const handleExport = () => {
    const data = JSON.stringify(regulations, null, 2);
    // Usar Blob URL evita límites de tamaño de data: URLs en navegadores
    const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reglamentos_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Revocar después de un tick para permitir que el navegador inicie la descarga
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleReset = () => {
    setRegulations(INITIAL_REGULATIONS);
    setActiveView("dashboard");
    setToast({ type: 'success', message: 'Datos restablecidos' });
  };

  /* ---------------- Convenios institucionales ---------------- */

  const usuarioActual = () => sessionStorage.getItem("umag_user") || 'Usuario UMAG';

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
    // completa desde el primer día (regla de negocio N°9).
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

  const handleAddNormativa = (normativa) => {
    setNormativas(prev => [...prev, normativa]);
  };

  const handleDeleteNormativa = (id) => {
    setNormativas(prev => prev.filter(n => n.id !== id));
  };

  if (!isLoggedIn) {
    return (
      <div className="login-page">
        <form className="login-card" onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
          <div className="login-logo">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          </div>
          <h2 className="login-title">UMAG</h2>
          <p className="login-subtitle">Transparencia</p>
          <input type="text" className="login-input" placeholder="Usuario" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} autoComplete="username" />
          <input type="password" className="login-input" placeholder="Contraseña" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} autoComplete="current-password" />
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.75rem', cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} style={{ accentColor: '#3b82f6', width: '16px', height: '16px', cursor: 'pointer' }} />
            Recordar mi usuario
          </label>
          {loginError && <div style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{loginError}</div>}
          <button type="submit" className="login-button">Iniciar Sesión</button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      <Header userName={sessionStorage.getItem("umag_user") || "Usuario UMAG"} onLogout={handleLogout} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="app-body">
        <div className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)}></div>
        <Sidebar activeView={activeView} onViewChange={(view) => { setActiveView(view); setSidebarOpen(false); }} sidebarOpen={sidebarOpen} />
        <div className="content">
          <div className="page-container">
            <Suspense fallback={<PageLoader />}>
              {/* --- Módulo de Transparencia y Convenios --- */}
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

              {/* --- Módulo de Reglamentos (existente) --- */}
              {activeView === "resumen" && <ResumenEjecutivo regulations={regulations} />}
              {activeView === "dashboard" && <Dashboard regulations={regulations} onExport={handleExport} onReset={handleReset} />}
              {activeView === "regulations" && <RegulationsList regulations={regulations} onSelectRegulation={handleSelectRegulation} onUpdateRegulation={handleSaveRegulation} />}
              {activeView === "detail" && (selectedRegulation ? (
                <RegulationDetail regulation={selectedRegulation} onBack={() => setActiveView("regulations")} onSave={handleSaveRegulation} onDelete={handleDeleteRegulation} />
              ) : (
                <div className="page-content"><p style={{ color: '#94a3b8' }}>Selecciona un reglamento desde la lista.</p><button className="btn btn-secondary" onClick={() => setActiveView("regulations")}>Ir a Reglamentos</button></div>
              ))}
              {activeView === "new" && (
                <NewRegulation onCreate={handleCreateRegulation} onCancel={() => setActiveView("regulations")} />
              )}
              {activeView === "gantt" && (
                <GanttView regulations={regulations} />
              )}
              {activeView === "documentos" && (
                <DocumentosView regulations={regulations} onSelectRegulation={handleSelectRegulation} />
              )}
              {activeView === "plazos" && <PlazosList regulations={regulations} />}
              {activeView === "normativa" && (
                <Normativa
                  regulations={regulations}
                  normativas={normativas}
                  onAddNormativa={handleAddNormativa}
                  onDeleteNormativa={handleDeleteNormativa}
                  onUpdateRegulation={handleSaveRegulation}
                  showToast={setToast}
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

export default App;