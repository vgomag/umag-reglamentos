import React, { useState, useRef } from 'react';

function RegulationDetail({ regulation, onBack, onSave, onDelete }) {
  const [formData, setFormData] = useState(regulation);
  const fileInputRef = useRef(null);
  const pdfInputRef = useRef(null);
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

  return (
    <div className="page-content">
      <button className="btn btn-secondary" onClick={onBack} style={{ marginBottom: "1.5rem" }}>← Volver</button>
      <div className="detail-header">
        <h2 className="detail-title">{formData.nombre}</h2>
        <div className="detail-meta">
          {formData.numero && <div className="detail-badge">N° {formData.numero}</div>}
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
          <h3 className="section-title">Observaciones y Requisitos Normativos</h3>
          <textarea
            value={formData.observaciones || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
            placeholder="Notas, pendientes, acuerdos, requisitos normativos..."
            style={{ minHeight: '300px', width: '100%', fontSize: '0.9rem', lineHeight: '1.6', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontFamily: 'inherit', resize: 'vertical' }}
          ></textarea>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem' }}>
            Los requisitos normativos de documentos cargados en la sección Normativa aparecerán aquí automáticamente.
          </div>
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

        {formData.adjuntos && formData.adjuntos.length > 0 && (
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

    </div>
  );
}

export default RegulationDetail;
