import React, { useState, useEffect, useRef } from 'react';
import { INITIAL_REGULATIONS } from './config/data';
import NewRegulation from './pages/NewRegulation';
import PlazosList from './pages/PlazosList';
import Settings from './pages/Settings';
import Normativa from './pages/Normativa';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import ResumenEjecutivo from './pages/ResumenEjecutivo';
import Dashboard from './pages/Dashboard';
import RegulationsList from './pages/RegulationsList';
import RegulationDetail from './pages/RegulationDetail';
import { supabase, supabaseSeedIfEmpty, supabaseFetchAll, supabaseUpsert, supabaseDelete, supabaseInsert } from './config/supabase';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [regulations, setRegulations] = useState(() => {
    const saved = localStorage.getItem("regulations");
    return saved ? JSON.parse(saved) : INITIAL_REGULATIONS;
  });
  const [activeView, setActiveView] = useState("resumen");
  const [selectedRegulation, setSelectedRegulation] = useState(null);
  const [toast, setToast] = useState(null);
  const [dbMode, setDbMode] = useState(supabase ? 'supabase' : 'local');
  const [isLoading, setIsLoading] = useState(!!supabase);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [normativas, setNormativas] = useState(() => {
    const saved = localStorage.getItem('umag_normativas');
    return saved ? JSON.parse(saved) : [];
  });

  // Cargar datos desde Supabase al inicio
  useEffect(() => {
    if (supabase) {
      (async () => {
        await supabaseSeedIfEmpty();
        const data = await supabaseFetchAll();
        if (data) {
          setRegulations(data);
          setDbMode('supabase');
        } else {
          setDbMode('local');
        }
        setIsLoading(false);
      })();
    }
  }, []);

  // Sincronizar con localStorage como backup
  useEffect(() => {
    localStorage.setItem("regulations", JSON.stringify(regulations));
  }, [regulations]);

  // Persist normativas to localStorage
  useEffect(() => {
    localStorage.setItem('umag_normativas', JSON.stringify(normativas));
  }, [normativas]);

  const AUTH_PASSWORD = 'umag2026';
  const [loginError, setLoginError] = useState('');
  const loginPasswordRef = useRef(null);

  const handleLogin = () => {
    const passwordInput = loginPasswordRef.current;
    if (!passwordInput || passwordInput.value !== AUTH_PASSWORD) {
      setLoginError('Contraseña incorrecta');
      return;
    }
    setLoginError('');
    sessionStorage.setItem("umag_auth", "true");
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("umag_auth");
    setIsLoggedIn(false);
    handleGoogleDisconnect();
    setActiveView("dashboard");
  };

  const handleSelectRegulation = (reg) => {
    setSelectedRegulation(reg);
    setActiveView("detail");
  };

  const handleSaveRegulation = async (updatedReg) => {
    setRegulations(prev => prev.map(r => r.id === updatedReg.id ? updatedReg : r));
    setSelectedRegulation(updatedReg);
    if (dbMode === 'supabase') await supabaseUpsert(updatedReg);
    setToast({ type: 'success', message: 'Reglamento guardado' });
  };

  const handleDeleteRegulation = async () => {
    if (!window.confirm(`¿Estás seguro de eliminar "${selectedRegulation.nombre}"? Esta acción no se puede deshacer.`)) return;
    if (dbMode === 'supabase') await supabaseDelete(selectedRegulation.id);
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
    }
    const id = Math.max(...regulations.map(r => r.id), 0) + 1;
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
        <div className="login-card">
          <div className="login-logo">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          </div>
          <h2 className="login-title">UMAG</h2>
          <p className="login-subtitle">Sistema de Seguimiento de Reglamentos</p>
          <input type="text" className="login-input" placeholder="Usuario" defaultValue="admin" />
          <input type="password" className="login-input" placeholder="Contraseña" ref={loginPasswordRef} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
          {loginError && <div style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{loginError}</div>}
          <button className="login-button" onClick={handleLogin}>Iniciar Sesión</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      <Header userName="Usuario UMAG" onLogout={handleLogout} isGoogleConnected={isGoogleConnected} googleUser={googleUser} onGoogleDisconnect={handleGoogleDisconnect} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="app-body">
        <div className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)}></div>
        <Sidebar activeView={activeView} onViewChange={(view) => { setActiveView(view); setSidebarOpen(false); }} sidebarOpen={sidebarOpen} />
        <div className="content">
          <div className="page-container">
            {activeView === "resumen" && <ResumenEjecutivo regulations={regulations} />}
            {activeView === "dashboard" && <Dashboard regulations={regulations} />}
            {activeView === "regulations" && <RegulationsList regulations={regulations} onSelectRegulation={handleSelectRegulation} onUpdateRegulation={handleSaveRegulation} />}
            {activeView === "detail" && selectedRegulation && (
              <RegulationDetail regulation={selectedRegulation} onBack={() => setActiveView("regulations")} onSave={handleSaveRegulation} onDelete={handleDeleteRegulation} googleToken={googleToken} isGoogleConnected={isGoogleConnected} />
            )}
            {activeView === "new" && (
              <NewRegulation onCreate={handleCreateRegulation} onCancel={() => setActiveView("regulations")} />
            )}
            {activeView === "plazos" && <PlazosList />}
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
            {activeView === "settings" && (
              <Settings regulations={regulations} onReset={handleReset} onExport={handleExport} googleToken={googleToken} isGoogleConnected={isGoogleConnected} onGoogleDisconnect={handleGoogleDisconnect} googleUser={googleUser} dbMode={dbMode} />
            )}
          </div>
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export default App;