import React, { useState, useEffect, useRef } from 'react';
import { INITIAL_REGULATIONS } from './config/data';
import { GOOGLE_CLIENT_ID, GOOGLE_SCOPES } from './config/google';
import NewRegulation from './pages/NewRegulation';
import PlazosList from './pages/PlazosList';
import Settings from './pages/Settings';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import ResumenEjecutivo from './components/ResumenEjecutivo';
import Dashboard from './components/Dashboard';
import RegulationsList from './components/RegulationsList';
import RegulationDetail from './components/RegulationDetail';

// Supabase configuration placeholder
const supabase = null; // Set this to your Supabase client when available

// Placeholder Supabase functions
const supabaseSeedIfEmpty = async () => {};
const supabaseFetchAll = async () => null;
const supabaseUpsert = async () => {};
const supabaseDelete = async () => {};
const supabaseInsert = async (newReg) => {
  const id = Math.max(...(await supabaseFetchAll() || []).map(r => r.id), 0) + 1;
  return { ...newReg, id, historial: [], adjuntos: [] };
};

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [googleToken, setGoogleToken] = useState(null);
  const [googleUser, setGoogleUser] = useState(null);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
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

  // Initialize Google and restore token
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.triggerGoogleConnect = handleGoogleConnect;
    }

    const saved = sessionStorage.getItem('google_token');
    if (saved) {
      setGoogleToken(saved);
      setIsGoogleConnected(true);
      restoreGoogleUser(saved, false);
    }
  }, []);

  const restoreGoogleUser = async (token, isNewConnection) => {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (response.ok) {
        const info = await response.json();
        setGoogleUser(info);
      } else if (!isNewConnection) {
        sessionStorage.removeItem('google_token');
        setGoogleToken(null);
        setIsGoogleConnected(false);
      }
    } catch (e) {
      if (!isNewConnection) {
        sessionStorage.removeItem('google_token');
        setGoogleToken(null);
        setIsGoogleConnected(false);
      }
    }
  };

  const handleGoogleConnect = () => {
    if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPES,
        callback: (response) => {
          if (response.access_token) {
            setGoogleToken(response.access_token);
            setIsGoogleConnected(true);
            sessionStorage.setItem('google_token', response.access_token);
            restoreGoogleUser(response.access_token, true);
            setToast({ type: 'success', message: 'Google conectado correctamente' });
          }
        }
      });
      client.requestAccessToken();
    } else {
      alert('Google APIs no disponibles. Espera a que carguen e intenta de nuevo.');
    }
  };

  const handleGoogleDisconnect = () => {
    if (googleToken) {
      try {
        google.accounts.oauth2.revoke(googleToken);
      } catch (e) {
        // Ignore revoke errors
      }
    }
    setGoogleToken(null);
    setGoogleUser(null);
    setIsGoogleConnected(false);
    sessionStorage.removeItem('google_token');
    setToast({ type: 'info', message: 'Google desconectado' });
  };

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
