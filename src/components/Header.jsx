import React, { useState } from 'react';

function Header({ userName, onLogout, isGoogleConnected, googleUser, onGoogleDisconnect, onToggleSidebar }) {
  const [showGoogleDropdown, setShowGoogleDropdown] = useState(false);

  return (
    <div className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button className="mobile-menu-btn" onClick={onToggleSidebar}>☰</button>
        <h1>UMAG - Sistema de Seguimiento de Reglamentos</h1>
      </div>
      <div className="header-actions">
        <div className="user-info">{userName}</div>
        {isGoogleConnected && googleUser && (
          <div className="google-user-menu">
            <button className="google-user-btn" onClick={() => setShowGoogleDropdown(!showGoogleDropdown)}>
              <div className="google-user-avatar">{googleUser.name?.charAt(0).toUpperCase() || 'G'}</div>
              <span>{googleUser.email?.split('@')[0]}</span>
            </button>
            {showGoogleDropdown && (
              <div className="google-dropdown">
                <div className="google-dropdown-item">{googleUser.email}</div>
                <div className="google-dropdown-item danger" onClick={() => { onGoogleDisconnect(); setShowGoogleDropdown(false); }}>Desconectar Google</div>
              </div>
            )}
          </div>
        )}
        {!isGoogleConnected && (
          <button className="google-btn" onClick={() => window.triggerGoogleConnect?.()}>
            🔗 Conectar Google
          </button>
        )}
        <button className="logout-btn" onClick={onLogout}>Cerrar Sesión</button>
      </div>
    </div>
  );
}

export default Header;
