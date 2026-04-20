import React, { useState, useEffect, lazy, Suspense } from 'react';
import { INITIAL_REGULATIONS } from './config/data';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import { supabase, supabaseSeedIfEmpty, supabaseFetchAll, supabaseUpsert, supabaseDelete, supabaseInsert } from './config/supabase';

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
  const [activeView, setActiveView] = useState("resumen");
  const [selectedRegulation, setSelectedRegulation] = useState(null);
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
    if (supabase) {
      (async () => {
        await supabaseSeedIfEmpty(INITIAL_REGULATIONS);
        const data = await supabaseFetchAll();
        if (data) {
          setRegulations(data);
          setDbMode('supabase');
        } else {
          setDbMode('local');
        }
        setIsLoading(false);
      })().catch(e => {
        console.warn('Error inicializando Supabase:', e.message);
        setDbMode('local');
        setIsLoading(false);
      });
    }
  }, []);

  // Sincronizar con localStorage como backup
  useEffect(() => {
    try { localStorage.setItem("regulations", JSON.stringify(regulations)); }
    catch (e) { console.warn('No se pudo guardar en localStorage:', e.message); }
  }, [regulations]);

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
    setActiveView("resumen");
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
    const link = document.createElement("a");
    link.href = "data:application/json;charset=utf-8," + encodeURIComponent(data);
    link.download = `reglamentos_${new Date().toISOString().split("T")[0]}.json`;
    link.click();
  };

  const handleReset = () => {
    setRegulations(INITIAL_REGULATIONS);
    setActiveView("dashboard");
    setToast({ type: 'success', message: 'Datos restablecidos' });
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
          <p className="login-subtitle">Sistema de Seguimiento de Reglamentos</p>
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