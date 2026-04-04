import React, { useState, useEffect } from 'react';

function Settings({ regulations, onReset, onExport, googleToken, isGoogleConnected, onGoogleDisconnect, googleUser, dbMode }) {
  const [estatutoDate, setEstatutoDate] = useState(() => {
    const saved = localStorage.getItem("estatuto_date");
    return saved || "2025-01-18";
  });
  const [notificationEmails, setNotificationEmails] = useState(() => {
    const saved = localStorage.getItem("notification_emails");
    return saved || "";
  });
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleSaveSettings = () => {
    localStorage.setItem("estatuto_date", estatutoDate);
    localStorage.setItem("notification_emails", notificationEmails);
    alert("Configuración guardada");
  };

  const sendProgressReport = async () => {
    if (!googleToken) {
      alert("Conecta Google primero");
      return;
    }

    if (!notificationEmails) {
      alert("Configura correos de notificación primero");
      return;
    }

    const aprobados = regulations.filter(r => r.estado === "Aprobado").length;
    const enProceso = regulations.filter(r => r.estado === "En Proceso").length;
    const pendientes = regulations.filter(r => r.estado === "Pendiente").length;
    const avance = Math.round((aprobados / regulations.length) * 100);

    let body = `REPORTE DE AVANCE - REGLAMENTOS UMAG\n${'='.repeat(40)}\n\n`;
    body += `Fecha: ${new Date().toLocaleDateString('es-CL')}\n\n`;
    body += `RESUMEN GENERAL\n`;
    body += `- Total de reglamentos: ${regulations.length}\n`;
    body += `- Aprobados: ${aprobados}\n`;
    body += `- En Proceso: ${enProceso}\n`;
    body += `- Pendientes: ${pendientes}\n`;
    body += `- Avance general: ${avance}%\n\n`;
    body += `DETALLE POR REGLAMENTO\n${'-'.repeat(40)}\n\n`;

    regulations.forEach(r => {
      body += `${r.numero}. ${r.nombre}\n`;
      body += `   Estado: ${r.estado} | Progreso: ${r.progreso}% | Prioridad: ${r.prioridad}\n`;
      if (r.responsable) body += `   Responsable: ${r.responsable}\n`;
      body += '\n';
    });

    const subject = `Reporte de Avance - Reglamentos UMAG (${new Date().toLocaleDateString('es-CL')})`;
    const email = [
      `To: ${notificationEmails}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body
    ].join('\r\n');

    const encodedEmail = btoa(unescape(encodeURIComponent(email))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    try {
      const resp = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + googleToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: encodedEmail })
      });

      if (resp.ok) {
        alert("Reporte enviado correctamente");
      } else {
        const errData = await resp.json().catch(() => ({}));
        alert("Error al enviar reporte: " + (errData.error?.message || `código ${resp.status}`));
      }
    } catch (e) {
      alert("Error de conexión: " + e.message);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Configuración</h2>
        <p>Gestiona los parámetros del sistema</p>
      </div>

      <div className="google-integration-section">
        <h3>🔐 Integraciones Google</h3>
        <div className={`google-integration-status ${isGoogleConnected ? 'connected' : 'disconnected'}`}>
          <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
            {isGoogleConnected ? '✓ Conectado' : '✕ Desconectado'}
          </div>
          {isGoogleConnected && googleUser && (
            <div style={{ fontSize: '0.875rem', color: '#475569' }}>
              {googleUser.email}
            </div>
          )}
          {!isGoogleConnected && (
            <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.5rem' }}>
              Conecta tu cuenta Google para acceder a Calendar, Gmail y Drive
            </div>
          )}
        </div>

        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', fontSize: '0.85rem', color: '#475569', lineHeight: '1.6' }}>
          <strong>Setup Requerido:</strong>
          <ol style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
            <li>Crea un proyecto en <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" style={{ color: '#1a56db' }}>Google Cloud Console</a></li>
            <li>Activa APIs: Google Calendar, Gmail, Google Drive</li>
            <li>Crea una credencial OAuth 2.0 (Cliente Web)</li>
            <li>Reemplaza GOOGLE_CLIENT_ID en el código con tu ID</li>
          </ol>
        </div>

        <div className="google-integration-buttons">
          {!isGoogleConnected && (
            <button className="btn google-btn" onClick={() => window.triggerGoogleConnect?.()}>
              🔗 Conectar Google
            </button>
          )}
          {isGoogleConnected && (
            <>
              <button className="btn btn-primary" onClick={sendProgressReport} style={{ marginRight: '0.75rem' }}>
                📊 Enviar Reporte
              </button>
              <button className="btn btn-secondary" onClick={() => {
                if (window.confirm('¿Desconectar Google?')) {
                  onGoogleDisconnect();
                }
              }}>
                ✕ Desconectar
              </button>
            </>
          )}
        </div>
      </div>

      <div className="section" style={{ marginBottom: '2rem' }}>
        <h3 className="section-title">Base de Datos</h3>
        <div style={{ padding: '1rem', background: dbMode === 'supabase' ? '#d1fae5' : '#fef3c7', borderRadius: '8px', marginBottom: '1rem', borderLeft: `4px solid ${dbMode === 'supabase' ? '#10b981' : '#f59e0b'}` }}>
          <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
            {dbMode === 'supabase' ? '✓ Conectado a Supabase' : '⚠ Usando almacenamiento local'}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#475569' }}>
            {dbMode === 'supabase'
              ? 'Los datos se guardan en PostgreSQL (Supabase). Múltiples usuarios pueden acceder simultáneamente.'
              : 'Los datos se guardan en el navegador (localStorage). Para persistencia real y acceso multiusuario, configura Supabase.'
            }
          </div>
        </div>
        {dbMode !== 'supabase' && (
          <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', fontSize: '0.85rem', color: '#475569', lineHeight: '1.6' }}>
            <strong>Configurar Supabase:</strong>
            <ol style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
              <li>Crea un proyecto en <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" style={{ color: '#1a56db' }}>supabase.com/dashboard</a></li>
              <li>Ve a SQL Editor y ejecuta el SQL incluido en el código</li>
              <li>Copia tu URL y Anon Key desde Settings → API</li>
              <li>Reemplaza SUPABASE_URL y SUPABASE_ANON_KEY en el código</li>
            </ol>
          </div>
        )}
      </div>

      <div className="section" style={{ marginBottom: '2rem' }}>
        <h3 className="section-title">Parámetros de Sistema</h3>
        <div className="form-group">
          <label>Fecha de Entrada en Vigencia del Estatuto</label>
          <input type="date" value={estatutoDate} onChange={(e) => setEstatutoDate(e.target.value)} />
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Se usa para calcular plazos relativos</div>
        </div>
        <div className="form-group">
          <label>Correos para Notificaciones (separados por comas)</label>
          <textarea value={notificationEmails} onChange={(e) => setNotificationEmails(e.target.value)} placeholder="usuario1@example.com, usuario2@example.com"></textarea>
        </div>
        <button className="btn btn-primary" onClick={handleSaveSettings} style={{ marginRight: '0.75rem' }}>Guardar Configuración</button>
      </div>

      <div className="section" style={{ marginBottom: '2rem' }}>
        <h3 className="section-title">Acciones</h3>
        <button className="btn btn-secondary" onClick={onExport} style={{ marginRight: "0.75rem" }}>📥 Exportar Datos</button>
        <button className="btn btn-danger" onClick={() => setShowResetConfirm(true)}>🔄 Restablecer Datos</button>
      </div>

      {showResetConfirm && (
        <div className="modal-overlay" onClick={() => setShowResetConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Restablecer todos los datos</h3>
            <p className="modal-content">Esta acción eliminará todos los cambios y restaurará los datos originales. ¿Estás seguro?</p>
            <div className="btn-group" style={{ marginTop: "1.5rem" }}>
              <button className="btn btn-danger" onClick={() => { onReset(); setShowResetConfirm(false); }}>Restablecer</button>
              <button className="btn btn-secondary" onClick={() => setShowResetConfirm(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;
