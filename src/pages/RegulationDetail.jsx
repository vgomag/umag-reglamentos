import React, { useState, useRef } from 'react';

function RegulationDetail({ regulation, onBack, onSave, onDelete, googleToken, isGoogleConnected }) {
  const [formData, setFormData] = useState(regulation);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyEmails, setNotifyEmails] = useState("");
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [meetingData, setMeetingData] = useState({ startTime: "", endTime: "", duration: "60", emails: "" });
  const [showDriveModal, setShowDriveModal] = useState(false);
  const fileInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const driveInputRef = useRef(null);
  const [pdfExtracting, setPdfExtracting] = useState(false);
  const [pdfProgress, setPdfProgress] = useState('');
  const [pdfExtractedData, setPdfExtractedData] = useState(null);
  const [pdfUploading, setPdfUploading] = useState(false);

  // Extract text from PDF using pdf.js
  const extractPdfText = async (file) => {
    if (!window.pdfjsLib) {
      alert('La librería PDF.js no está disponible. Recarga la página.');
      return null;
    }
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(item => item.str).join(' ') + '\n';
    }
    return fullText;
  };

  // Parse extracted text to find regulation metadata
  const parseRegulationData = (text) => {
    const data = {};
    // Detect decree number (DEC, DECRETO, RESOLUCIÓN patterns)
    const decretoMatch = text.match(/(?:DEC(?:RETO)?\.?\s*(?:EX(?:ENTO)?\.?)?\s*(?:N[°º]?\s*)?(\d+[\w\/\-]*(?:\/SU\/\d{4})?))/i)
      || text.match(/(?:DECRETO\s+(?:UNIVERSITARIO\s+)?(?:EXENTO\s+)?N[°º]?\s*(\d+[\w\/\-]*))/i)
      || text.match(/(?:RESOL(?:UCIÓN)?\.?\s*(?:EX(?:ENTA)?\.?)?\s*N[°º]?\s*(\d+[\w\/\-]*))/i);
    if (decretoMatch) data.decreto = decretoMatch[0].trim();

    // Detect statute article references
    const artMatch = text.match(/(?:Art(?:ículo)?\.?\s*(\d+(?:\s*(?:letra\s+\w\)|y\s+\d+|al?\s+\d+|,\s*\d+)*)?))/i);
    if (artMatch) data.articulo_estatuto = artMatch[0].trim();

    // Detect responsible unit
    const respPatterns = [
      /Secretar[ií]a\s+General/i, /VRAF/i, /VRAC/i, /VRAE/i, /VRI/i,
      /Dir(?:ección|\.)\s+(?:de\s+)?(?:Docencia|Aseguramiento|Investigación)/i,
      /Rector[ía]?a?/i, /Contraloría/i
    ];
    for (const p of respPatterns) {
      const m = text.match(p);
      if (m) { data.responsable = m[0]; break; }
    }

    // Detect regulation name from title patterns
    const nameMatch = text.match(/(?:REGLAMENTO\s+(?:DE\s+|PARA\s+|SOBRE\s+|GENERAL\s+DE\s+)?[A-ZÁÉÍÓÚÑ\s,]+)/i);
    if (nameMatch && nameMatch[0].length > 15 && nameMatch[0].length < 200) {
      data.nombre_sugerido = nameMatch[0].trim().replace(/\s+/g, ' ');
    }

    // Detect dates
    const dateMatch = text.match(/(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(\d{4})/i);
    if (dateMatch) data.fecha_documento = dateMatch[0];

    // Extract first ~500 chars as summary for observaciones
    const cleanText = text.replace(/\s+/g, ' ').trim();
    if (cleanText.length > 50) {
      data.resumen = cleanText.substring(0, 500) + (cleanText.length > 500 ? '...' : '');
    }

    return data;
  };

  // Upload PDF to Supabase Storage
  const uploadPdfToStorage = async (file) => {
    if (!window.supabase) return null;
    const fileName = `reg-${formData.id || 'new'}/${Date.now()}-${file.name}`;
    try {
      const { data, error } = await window.supabase.storage
        .from('reglamentos-pdf')
        .upload(fileName, file, { contentType: 'application/pdf', upsert: true });
      if (error) throw error;
      const { data: urlData } = window.supabase.storage.from('reglamentos-pdf').getPublicUrl(fileName);
      return { path: fileName, url: urlData.publicUrl };
    } catch (e) {
      console.error('Error uploading PDF:', e);
      return null;
    }
  };

  // Main PDF upload handler
  const handlePdfUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') {
      if (file) alert('Por favor selecciona un archivo PDF');
      return;
    }

    setPdfExtracting(true);
    setPdfProgress('Leyendo PDF...');
    setPdfExtractedData(null);

    try {
      // Step 1: Extract text
      setPdfProgress('Extrayendo texto del PDF...');
      const text = await extractPdfText(file);

      // Step 2: Parse metadata
      setPdfProgress('Analizando contenido...');
      const extracted = text ? parseRegulationData(text) : {};
      extracted._fileName = file.name;
      extracted._fileSize = file.size;

      // Step 3: Upload to Supabase Storage
      setPdfProgress('Subiendo PDF a almacenamiento...');
      setPdfUploading(true);
      const storageResult = await uploadPdfToStorage(file);
      setPdfUploading(false);

      if (storageResult) {
        extracted._storageUrl = storageResult.url;
        extracted._storagePath = storageResult.path;
      }

      // Step 4: Add as attachment
      const newAttachment = {
        name: file.name,
        type: file.type,
        size: file.size,
        date: new Date().toLocaleDateString(),
        source: storageResult ? 'supabase' : 'local',
        url: storageResult?.url || null,
        storagePath: storageResult?.path || null
      };
      setFormData(prev => ({ ...prev, adjuntos: [...prev.adjuntos, newAttachment] }));

      setPdfExtractedData(extracted);
      setPdfProgress('Extracción completada');
    } catch (e) {
      console.error('Error processing PDF:', e);
      setPdfProgress('Error al procesar el PDF: ' + e.message);
    } finally {
      setPdfExtracting(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  // Apply a single extracted field
  const applyExtractedField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setPdfExtractedData(prev => {
      const updated = { ...prev };
      updated['_applied_' + field] = true;
      return updated;
    });
  };

  // Apply all extracted fields
  const applyAllExtracted = () => {
    if (!pdfExtractedData) return;
    const updates = {};
    if (pdfExtractedData.decreto && !pdfExtractedData._applied_decreto) updates.decreto = pdfExtractedData.decreto;
    if (pdfExtractedData.articulo_estatuto && !pdfExtractedData._applied_articulo_estatuto) updates.articulo_estatuto = pdfExtractedData.articulo_estatuto;
    if (pdfExtractedData.responsable && !pdfExtractedData._applied_responsable) updates.responsable = pdfExtractedData.responsable;
    if (pdfExtractedData._storageUrl && !pdfExtractedData._applied_enlace) updates.enlace = pdfExtractedData._storageUrl;
    setFormData(prev => ({ ...prev, ...updates }));
    setPdfExtractedData(prev => {
      const updated = { ...prev };
      Object.keys(updates).forEach(k => updated['_applied_' + k] = true);
      return updated;
    });
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type === 'application/pdf') {
        handlePdfUpload(event);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const newAttachment = {
          name: file.name,
          type: file.type,
          size: file.size,
          date: new Date().toLocaleDateString(),
          data: e.target.result,
          source: 'local'
        };
        setFormData(prev => ({ ...prev, adjuntos: [...prev.adjuntos, newAttachment] }));
      };
      reader.onerror = () => {
        alert('Error al leer el archivo. Intenta nuevamente.');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveFile = (index) => {
    if (!window.confirm('¿Eliminar este archivo adjunto?')) return;
    setFormData(prev => ({ ...prev, adjuntos: prev.adjuntos.filter((_, i) => i !== index) }));
  };

  const sendStatusNotification = async () => {
    if (!googleToken || !notifyEmails) {
      alert("Conecta Google y proporciona emails");
      return;
    }

    const subject = `UMAG Reglamentos - Cambio de estado: ${formData.nombre}`;
    const body = `Estimado/a,\n\nLe informamos que el reglamento "${formData.nombre}" ha cambiado su estado.\n\nReglamento: ${formData.nombre}\nArtículo: ${formData.articulo}\nNuevo Estado: ${formData.estado}\nResponsable: ${formData.responsable || 'No asignado'}\nProgreso: ${formData.progreso}%\n\nSaludos cordiales,\nSistema de Seguimiento UMAG`;

    const email = [
      `To: ${notifyEmails}`,
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
        alert("Notificación enviada");
        setShowNotifyModal(false);
        setNotifyEmails("");
      } else {
        const errData = await resp.json().catch(() => ({}));
        alert("Error al enviar notificación: " + (errData.error?.message || `código ${resp.status}`));
      }
    } catch (e) {
      alert("Error de conexión: " + e.message);
    }
  };

  const scheduleReviewMeeting = async () => {
    if (!googleToken || !meetingData.startTime) {
      alert("Conecta Google y proporciona fecha");
      return;
    }

    const start = new Date(meetingData.startTime);
    const duration = parseInt(meetingData.duration) || 60;
    const end = new Date(start.getTime() + duration * 60000);

    // Validar emails
    const emailList = meetingData.emails.split(',').map(e => e.trim()).filter(Boolean);
    const invalidEmails = emailList.filter(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (invalidEmails.length > 0) {
      alert("Correos inválidos: " + invalidEmails.join(', '));
      return;
    }

    const event = {
      summary: `Revisión: ${formData.nombre}`,
      description: `Reglamento N°${formData.numero}: ${formData.nombre}\nEstado: ${formData.estado}\nArtículo: ${formData.articulo}`,
      start: { dateTime: start.toISOString(), timeZone: 'America/Santiago' },
      end: { dateTime: end.toISOString(), timeZone: 'America/Santiago' },
      attendees: emailList.map(e => ({ email: e })),
      reminders: { useDefault: true }
    };

    try {
      const resp = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + googleToken, 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      });
      if (resp.ok) {
        alert("Reunión programada correctamente");
        setShowMeetingModal(false);
        setMeetingData({ startTime: "", endTime: "", duration: "60", emails: "" });
      } else {
        const errData = await resp.json().catch(() => ({}));
        alert("Error al programar reunión: " + (errData.error?.message || `código ${resp.status}`));
      }
    } catch (e) {
      alert("Error de conexión: " + e.message);
    }
  };

  const uploadToDrive = async (file) => {
    if (!googleToken) {
      alert("Conecta Google primero");
      return;
    }

    const folderName = `UMAG Reglamentos - ${formData.nombre}`;

    try {
      let folderId;
      const searchResp = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(folderName)}'+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false`,
        { headers: { 'Authorization': 'Bearer ' + googleToken } }
      );
      if (!searchResp.ok) throw new Error('Error al buscar carpeta en Drive');
      const searchData = await searchResp.json();

      if (searchData.files && searchData.files.length > 0) {
        folderId = searchData.files[0].id;
      } else {
        const createResp = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + googleToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: folderName, mimeType: 'application/vnd.google-apps.folder' })
        });
        if (!createResp.ok) throw new Error('Error al crear carpeta en Drive');
        const folderData = await createResp.json();
        folderId = folderData.id;
      }

      const metadata = { name: file.name, parents: [folderId] };
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', file);

      const uploadResp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + googleToken },
        body: form
      });
      if (!uploadResp.ok) throw new Error('Error al subir archivo a Drive');
      const uploadData = await uploadResp.json();

      if (uploadData.id) {
        const newAttachment = {
          name: file.name,
          type: file.type,
          size: file.size,
          date: new Date().toLocaleDateString(),
          driveId: uploadData.id,
          driveUrl: uploadData.webViewLink,
          source: 'drive'
        };
        setFormData(prev => ({ ...prev, adjuntos: [...prev.adjuntos, newAttachment] }));
        alert("Archivo subido a Google Drive");
      }
    } catch (e) {
      alert("Error al subir a Drive: " + e.message);
    }
  };

  return (
    <div className="page-content">
      <button className="btn btn-secondary" onClick={onBack} style={{ marginBottom: "1.5rem" }}>← Volver</button>
      <div className="detail-header">
        <h2 className="detail-title">{formData.nombre}</h2>
        <div className="detail-meta">
          <div className="detail-badge">N° {formData.numero}</div>
          <div className="detail-badge">{formData.articulo}</div>
          <span className={`badge ${formData.estado.toLowerCase().replace(/\s+/g, '-')}`}>{formData.estado}</span>
        </div>
      </div>

      <div className="detail-sections">
        <div className="section">
          <h3 className="section-title">Información General</h3>
          <div className="form-group">
            <label>Estado</label>
            <select value={formData.estado} onChange={(e) => setFormData(prev => ({ ...prev, estado: e.target.value }))}>
              <option>Pendiente</option>
              <option>En Proceso</option>
              <option>En Revisión</option>
              <option>Aprobado</option>
            </select>
          </div>
          <div className="form-group">
            <label>Progreso (%)</label>
            <input type="number" min="0" max="100" value={formData.progreso} onChange={(e) => { const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0)); setFormData(prev => ({ ...prev, progreso: val })); }} />
          </div>
          <div className="form-group">
            <label>Responsable</label>
            <input type="text" value={formData.responsable} onChange={(e) => setFormData(prev => ({ ...prev, responsable: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Prioridad</label>
            <select value={formData.prioridad} onChange={(e) => setFormData(prev => ({ ...prev, prioridad: e.target.value }))}>
              <option>alta</option>
              <option>media</option>
              <option>baja</option>
            </select>
          </div>
          <div className="form-group">
            <label>Decreto / Resolución</label>
            <input type="text" value={formData.decreto || ''} onChange={(e) => setFormData(prev => ({ ...prev, decreto: e.target.value }))} placeholder="ej: DEC N°001/SU/2025" />
          </div>
          <div className="form-group">
            <label>Artículo del Estatuto</label>
            <input type="text" value={formData.articulo_estatuto || ''} onChange={(e) => setFormData(prev => ({ ...prev, articulo_estatuto: e.target.value }))} placeholder="ej: Art. 67" />
          </div>
          <div className="form-group">
            <label>Observaciones</label>
            <textarea value={formData.observaciones || ''} onChange={(e) => setFormData(prev => ({ ...prev, observaciones: e.target.value }))} placeholder="Notas, pendientes, acuerdos..." style={{ minHeight: '80px' }}></textarea>
          </div>
          <div className="form-group">
            <label>Enlace al documento</label>
            <input type="text" value={formData.enlace || ''} onChange={(e) => setFormData(prev => ({ ...prev, enlace: e.target.value }))} placeholder="https://..." />
            {formData.enlace && (
              <a href={formData.enlace} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: '#1a56db', display: 'inline-block', marginTop: '0.25rem' }}>🔗 Abrir documento</a>
            )}
          </div>
          <div className="btn-group">
            <button className="btn btn-primary" onClick={() => { onSave(formData); }}>Guardar Cambios</button>
            <button className="btn btn-danger" onClick={onDelete}>Eliminar</button>
          </div>
        </div>

        <div className="section">
          <h3 className="section-title">Integraciones Google</h3>
          {isGoogleConnected ? (
            <>
              <button className="btn btn-primary" onClick={() => setShowMeetingModal(true)} style={{ marginBottom: "0.75rem", width: "100%" }}>
                📅 Agendar Reunión
              </button>
              <button className="btn btn-primary" onClick={() => setShowNotifyModal(true)} style={{ width: "100%" }}>
                📧 Notificar Cambio
              </button>
            </>
          ) : (
            <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Conecta tu cuenta Google para usar estas funciones</div>
          )}
        </div>
      </div>

      <div className="section" style={{ marginBottom: "2rem" }}>
        <h3 className="section-title">Documentos Adjuntos</h3>

        {/* PDF Upload Zone */}
        <div className={`pdf-upload-zone ${pdfExtracting || pdfUploading ? 'uploading' : ''}`}
             onClick={() => !pdfExtracting && !pdfUploading && pdfInputRef.current?.click()}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📄</div>
          <div style={{ fontWeight: 600, color: "#1e40af", marginBottom: "0.25rem" }}>
            {pdfExtracting ? 'Extrayendo datos...' : pdfUploading ? 'Subiendo PDF...' : 'Subir PDF de Reglamento'}
          </div>
          <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
            {pdfExtracting || pdfUploading ? pdfProgress : 'El sistema extraerá automáticamente los datos del documento'}
          </div>
          <input type="file" accept=".pdf" style={{ display: 'none' }} ref={pdfInputRef} onChange={handlePdfUpload} />
        </div>

        {/* Extraction Progress */}
        {(pdfExtracting || pdfUploading) && pdfProgress && (
          <div className="pdf-progress">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div className="spinner" style={{ width: 18, height: 18, border: "2px solid #e5e7eb", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}></div>
              <span>{pdfProgress}</span>
            </div>
          </div>
        )}

        {/* Extraction Results */}
        {pdfExtractedData && (
          <div className="pdf-extraction-result">
            <div className="pdf-extraction-header">
              <span>Datos Extraídos del PDF</span>
              <button className="pdf-apply-all-btn" onClick={applyAllExtracted}>Aplicar Todos</button>
            </div>
            {Object.entries(pdfExtractedData).filter(([k, v]) => v && k !== 'resumen').map(([field, value]) => {
              const labels = {
                decreto: 'Decreto/Resolución',
                articulo_estatuto: 'Artículo Estatuto',
                responsable: 'Responsable',
                nombre_sugerido: 'Nombre Sugerido',
                fecha_documento: 'Fecha Documento'
              };
              return (
                <div key={field} className="pdf-field-row">
                  <span className="pdf-field-label">{labels[field] || field}</span>
                  <span className="pdf-field-value">{value}</span>
                  <button className="pdf-apply-btn" onClick={() => applyExtractedField(field, value)}>Aplicar</button>
                </div>
              );
            })}
            {pdfExtractedData.resumen && (
              <div style={{ marginTop: "0.75rem", padding: "0.75rem", background: "#f9fafb", borderRadius: "6px", fontSize: "0.85rem", color: "#4b5563" }}>
                <strong>Resumen:</strong> {pdfExtractedData.resumen}
              </div>
            )}
          </div>
        )}

        {/* General file upload */}
        <div className="upload-area" onClick={() => fileInputRef.current?.click()} style={{ marginTop: "0.75rem" }}>
          <div className="upload-area-icon">📎</div>
          <div className="upload-area-text">Otros archivos (Word, Excel, etc.)</div>
          <div className="upload-area-hint">Arrastra o haz clic para adjuntar</div>
          <input type="file" className="upload-input" ref={fileInputRef} onChange={handleFileUpload} />
        </div>

        {isGoogleConnected && (
          <button className="btn btn-secondary" onClick={() => setShowDriveModal(true)} style={{ marginTop: "1rem", width: "100%" }}>
            ☁️ Subir a Google Drive
          </button>
        )}

        {formData.adjuntos.length > 0 && (
          <div className="file-list">
            {formData.adjuntos.map((file, idx) => (
              <div key={idx} className="file-item">
                <div className="file-item-info">
                  <div className="file-item-icon">
                    {file.source === 'drive' ? '☁️' : file.source === 'supabase' ? '🗄️' : '📄'}
                  </div>
                  <div className="file-item-details">
                    <div className="file-item-name">
                      {file.name}
                      {file.source === 'supabase' && <span className="pdf-stored-badge">Supabase</span>}
                    </div>
                    <div className="file-item-meta">{file.date}{file.size ? ` • ${(file.size / 1024).toFixed(1)}KB` : ''}</div>
                  </div>
                </div>
                <div className="file-item-actions">
                  {file.source === 'drive' && file.driveUrl && (
                    <a href={file.driveUrl} target="_blank" rel="noopener noreferrer" className="file-action-btn" title="Abrir en Drive">🔗</a>
                  )}
                  {file.source === 'supabase' && file.url && (
                    <a href={file.url} target="_blank" rel="noopener noreferrer" className="file-action-btn" title="Ver PDF">🔗</a>
                  )}
                  <button className="file-action-btn danger" onClick={() => handleRemoveFile(idx)} title="Eliminar">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNotifyModal && (
        <div className="modal-overlay" onClick={() => setShowNotifyModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Notificar Cambio de Estado</h3>
            <div className="form-group">
              <label>Correos a Notificar (separados por comas)</label>
              <textarea value={notifyEmails} onChange={(e) => setNotifyEmails(e.target.value)} placeholder="usuario1@example.com, usuario2@example.com"></textarea>
            </div>
            <div className="btn-group">
              <button className="btn btn-primary" onClick={sendStatusNotification}>Enviar Notificación</button>
              <button className="btn btn-secondary" onClick={() => setShowNotifyModal(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showMeetingModal && (
        <div className="modal-overlay" onClick={() => setShowMeetingModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Agendar Reunión de Revisión</h3>
            <div className="form-group">
              <label>Fecha y Hora</label>
              <input type="datetime-local" value={meetingData.startTime} onChange={(e) => setMeetingData(prev => ({ ...prev, startTime: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Duración</label>
              <select value={meetingData.duration} onChange={(e) => setMeetingData(prev => ({ ...prev, duration: e.target.value }))}>
                <option value="30">30 minutos</option>
                <option value="60">1 hora</option>
                <option value="120">2 horas</option>
              </select>
            </div>
            <div className="form-group">
              <label>Participantes (correos separados por comas)</label>
              <textarea value={meetingData.emails} onChange={(e) => setMeetingData(prev => ({ ...prev, emails: e.target.value }))} placeholder="usuario1@example.com, usuario2@example.com"></textarea>
            </div>
            <div className="btn-group">
              <button className="btn btn-primary" onClick={scheduleReviewMeeting}>Programar Reunión</button>
              <button className="btn btn-secondary" onClick={() => setShowMeetingModal(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showDriveModal && (
        <div className="modal-overlay" onClick={() => setShowDriveModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Subir a Google Drive</h3>
            <p className="modal-content">Selecciona un archivo para subir a Google Drive</p>
            <div className="upload-area" onClick={() => driveInputRef.current?.click()}>
              <div className="upload-area-icon">☁️</div>
              <div className="upload-area-text">Haz clic para seleccionar archivo</div>
              <input type="file" style={{ display: 'none' }} ref={driveInputRef} onChange={(e) => { if (e.target.files[0]) { uploadToDrive(e.target.files[0]); setShowDriveModal(false); } }} />
            </div>
            <div className="btn-group" style={{ marginTop: "1.5rem" }}>
              <button className="btn btn-secondary" onClick={() => setShowDriveModal(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RegulationDetail;
