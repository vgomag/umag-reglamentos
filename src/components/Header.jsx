import React from 'react';

function Header({ userName, onLogout, onToggleSidebar }) {
  return (
    <div className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button className="mobile-menu-btn" onClick={onToggleSidebar}>☰</button>
        <h1>UMAG - Sistema de Seguimiento de Reglamentos</h1>
      </div>
      <div className="header-actions">
        <div className="user-info">{userName}</div>
        <button className="logout-btn" onClick={onLogout}>Cerrar Sesión</button>
      </div>
    </div>
  );
}

export default Header;
