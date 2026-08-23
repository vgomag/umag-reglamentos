import React from 'react';
import PropTypes from 'prop-types';

function Header({ userName, onLogout, onToggleSidebar, subtitulo }) {
  return (
    <div className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button className="mobile-menu-btn" onClick={onToggleSidebar}>☰</button>
        <h1>UMAG · Transparencia y Convenios</h1>
        {subtitulo && <span className="header-subtitulo">{subtitulo}</span>}
      </div>
      <div className="header-actions">
        <div className="user-info">{userName}</div>
        <button className="logout-btn" onClick={onLogout}>Cerrar Sesión</button>
      </div>
    </div>
  );
}

Header.propTypes = {
  userName: PropTypes.string.isRequired,
  onLogout: PropTypes.func.isRequired,
  onToggleSidebar: PropTypes.func.isRequired,
  subtitulo: PropTypes.string,
};

export default Header;
