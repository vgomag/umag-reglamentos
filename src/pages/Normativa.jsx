import React, { useState, useRef } from 'react';

function Normativa({ regulations, normativas, onAddNormativa, onDeleteNormativa, onUpdateRegulation, showToast }) {
  const [dragging, setDragging] = useState(false);
  const [documentName, setDocumentName] = useState("");
  const [documentType, setDocumentType] = useState("Otro");
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState("");
  const [showAssociationModal, setShowAssociationModal] = useState(false);
  const [pendingNormativa, setPendingNormativa] = useState(null);
  const [selectedAssociations, setSelectedAssociations] = useState([]);
  const [associationEditValues, setAssociationEditValues] = useState({});
  const fileInputRef = useRef(null);
  const [expandedId, setExpandedId] = useState(null);

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
      const items = content.items || [];
      fullText += items.map(item => item.str).join(' ') + '\n';
    }
    return fullText;
  };

  // Escape special regex characters in a string
  const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Auto-detect associations with existing regulations
  const detectAssociations = (textoExtraido) => {
    const associations = [];
    const textoLower = textoExtraido.toLowerCase();

    regulations.forEach(reg => {
      let matches = [];

      // Check for regulation number matches if numero exists
      if (reg.numero) {
        const numStr = String(reg.numero);
        const numberPatterns = [
          new RegExp(`\\b[Rr]eglamento\\s+(?:N[°º]?\\s*)?${escapeRegex(numStr)}\\b`, 'g'),
          new RegExp(`\\b[Rr]eg\\.?\\s+(?:N[°º]?\\s*)?${escapeRegex(numStr)}\\b`, 'g')
        ];
        numberPatterns.forEach(pattern => {
          const found = textoExtraido.match(pattern);
          if (found) matches.push(...found);
        });
      }

      // Check for regulation name matches using key words from the name
      if (reg.nombre) {
        // Try full name match
        try {
          const fullNameRegex = new RegExp(escapeRegex(reg.nombre), 'gi');
          const found = textoExtraido.match(fullNameRegex);
          if (found) matches.push(...found);
        } catch (e) { /* ignore regex errors */ }

        // Try matching key words (3+ chars) from the regulation name
        if (matches.length === 0) {
          const keywords = reg.nombre
            .split(/\s+/)
            .filter(w => w.length > 3)
            .map(w => w.toLowerCase());

          // If 2+ keywords found in text, consider it a match
          const matchedKeywords = keywords.filter(kw => textoLower.includes(kw));
          if (keywords.length >= 2 && matchedKeywords.length >= Math.ceil(keywords.length * 0.6)) {
            matches.push(reg.nombre);
          }
        }
      }

      if (matches.length > 0) {
        // Extract surrounding context (~200 characters)
        let requisito = "";

        // Try context around number
        if (reg.numero) {
          try {
            const regexCtx = new RegExp(`.{0,100}${escapeRegex(String(reg.numero))}.{0,100}`, 'gi');
            const ctxMatch = textoExtraido.match(regexCtx);
            if (ctxMatch) {
              requisito = ctxMatch[0].replace(/\s+/g, ' ').trim();
            }
          } catch (e) { /* ignore */ }
        }

        // Try context around name
        if (!requisito && reg.nombre) {
          try {
            const nameSnippet = reg.nombre.substring(0, 20);
            const nameRegex = new RegExp(`.{0,100}${escapeRegex(nameSnippet)}.{0,100}`, 'gi');
            const nameMatch = textoExtraido.match(nameRegex);
            if (nameMatch) {
              requisito = nameMatch[0].replace(/\s+/g, ' ').trim();
            }
          } catch (e) { /* ignore */ }
        }

        if (!requisito) {
          requisito = `Mención de ${reg.nombre}`;
        }

        associations.push({
          regulationId: reg.id,
          regulationNombre: reg.nombre,
          requisitos: requisito
        });
      }
    });

    return associations;
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === 'application/pdf') {
        processPdfFile(file);
      } else {
        alert('Por favor selecciona un archivo PDF');
      }
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      processPdfFile(file);
    } else if (file) {
      alert('Por favor selecciona un archivo PDF');
    }
  };

  const processPdfFile = async (file) => {
    setExtracting(true);
    setExtractProgress('Leyendo PDF...');

    try {
      // Step 1: Extract text
      setExtractProgress('Extrayendo texto del PDF...');
      const textoExtraido = await extractPdfText(file);

      if (!textoExtraido) {
        alert('No se pudo extraer texto del PDF');
        setExtracting(false);
        return;
      }

      // Step 2: Detect associations
      setExtractProgress('Detectando asociaciones con reglamentos...');
      const regulacionesAsociadas = detectAssociations(textoExtraido);

      // Step 3: Create resumen
      const cleanText = textoExtraido.replace(/\s+/g, ' ').trim();
      const resumen = cleanText.substring(0, 300) + (cleanText.length > 300 ? '...' : '');

      // Step 4: Prepare normativa object
      const nombreFinal = documentName || file.name.replace('.pdf', '');
      const newNormativa = {
        id: Date.now(),
        nombre: nombreFinal,
        tipo: documentType,
        fecha: new Date().toLocaleDateString('es-CL'),
        textoExtraido: textoExtraido,
        resumen: resumen,
        regulacionesAsociadas: regulacionesAsociadas,
        archivo: file.name
      };

      setPendingNormativa(newNormativa);
      setSelectedAssociations(regulacionesAsociadas.map((_, idx) => idx));
      setAssociationEditValues(regulacionesAsociadas.reduce((acc, assoc, idx) => {
        acc[idx] = assoc.requisitos;
        return acc;
      }, {}));
      setShowAssociationModal(true);
      setExtractProgress('');
    } catch (e) {
      console.error('Error processing PDF:', e);
      setExtractProgress('Error al procesar el PDF: ' + e.message);
    } finally {
      setExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setDocumentName("");
      setDocumentType("Otro");
    }
  };

  const handleConfirmAssociations = () => {
    if (!pendingNormativa) return;

    // Filter associations based on selection and apply edited values
    const finalAssociations = pendingNormativa.regulacionesAsociadas
      .map((assoc, idx) => ({
        ...assoc,
        requisitos: associationEditValues[idx] || assoc.requisitos
      }))
      .filter((_, idx) => selectedAssociations.includes(idx));

    // Update the normativa with final associations
    const normativaToAdd = {
      ...pendingNormativa,
      regulacionesAsociadas: finalAssociations
    };

    // Add normativa
    onAddNormativa(normativaToAdd);

    // Build all updates first, then apply them to avoid stale state
    const updatesMap = {};
    finalAssociations.forEach(assoc => {
      const regulation = regulations.find(r => r.id === assoc.regulationId);
      if (regulation) {
        const baseObs = updatesMap[assoc.regulationId]
          ? updatesMap[assoc.regulationId].observaciones
          : (regulation.observaciones || '');
        updatesMap[assoc.regulationId] = {
          ...regulation,
          observaciones: baseObs + `\n\n📋 Requisito normativo (${normativaToAdd.nombre}): ${assoc.requisitos}`
        };
      }
    });
    // Apply each unique regulation update
    Object.values(updatesMap).forEach(updatedReg => {
      onUpdateRegulation(updatedReg);
    });

    showToast({ message: `Normativa "${normativaToAdd.nombre}" agregada con ${finalAssociations.length} asociación(es)`, type: 'success' });
    setShowAssociationModal(false);
    setPendingNormativa(null);
    setSelectedAssociations([]);
    setAssociationEditValues({});
  };

  const handleDeleteNormativa = (id) => {
    if (window.confirm('¿Eliminar esta normativa?')) {
      onDeleteNormativa(id);
      showToast({ message: 'Normativa eliminada', type: 'success' });
    }
  };

  const toggleAssociationSelection = (idx) => {
    setSelectedAssociations(prev =>
      prev.includes(idx)
        ? prev.filter(i => i !== idx)
        : [...prev, idx]
    );
  };

  const handleAssociationEdit = (idx, value) => {
    setAssociationEditValues(prev => ({
      ...prev,
      [idx]: value
    }));
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Normativa</h2>
        <p>Suba documentos normativos para asociar requisitos a los reglamentos</p>
      </div>

      {/* Upload Section */}
      <div className="card" style={{ marginBottom: "2rem" }}>
        <h3 className="section-title">Subir Documento Normativo</h3>

        <div
          className={`pdf-upload-zone ${dragging ? 'dragging' : ''} ${extracting ? 'uploading' : ''}`}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !extracting && fileInputRef.current?.click()}
          style={{ cursor: extracting ? 'not-allowed' : 'pointer' }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📄</div>
          <div style={{ fontWeight: 600, color: "#1e40af", marginBottom: "0.25rem" }}>
            {extracting ? 'Procesando documento...' : 'Subir Documento Normativo'}
          </div>
          <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
            {extracting ? extractProgress : 'Arrastra un PDF aquí o haz clic para seleccionar'}
          </div>
          <input
            type="file"
            accept=".pdf"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handleFileInputChange}
            disabled={extracting}
          />
        </div>

        {(extracting && extractProgress) && (
          <div className="pdf-progress">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div className="spinner" style={{ width: 18, height: 18, border: "2px solid #e5e7eb", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}></div>
              <span>{extractProgress}</span>
            </div>
          </div>
        )}

        {!extracting && (
          <>
            <div className="form-group" style={{ marginTop: "1.5rem" }}>
              <label>Nombre del Documento</label>
              <input
                type="text"
                placeholder="Opcional - se usará el nombre del archivo si está vacío"
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Tipo de Documento</label>
              <select value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
                <option>Estatuto</option>
                <option>Ley</option>
                <option>Decreto</option>
                <option>Resolución</option>
                <option>Otro</option>
              </select>
            </div>
          </>
        )}
      </div>

      {/* Association Modal */}
      {showAssociationModal && pendingNormativa && (
        <div className="modal-overlay" onClick={() => !extracting && setShowAssociationModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "700px", maxHeight: "80vh", overflowY: "auto" }}>
            <h3 className="modal-title">Asociaciones Detectadas</h3>

            {pendingNormativa.regulacionesAsociadas.length > 0 ? (
              <>
                <p style={{ fontSize: "0.9rem", color: "#475569", marginBottom: "1rem" }}>
                  Se detectaron {pendingNormativa.regulacionesAsociadas.length} posible(s) asociación(es). Selecciona cuál(es) deseas aplicar y edita los requisitos si es necesario.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
                  {pendingNormativa.regulacionesAsociadas.map((assoc, idx) => (
                    <div key={idx} style={{
                      padding: "1rem",
                      border: "1px solid #e5e7eb",
                      borderRadius: "6px",
                      backgroundColor: selectedAssociations.includes(idx) ? "#f0f9ff" : "#ffffff"
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", marginBottom: "0.75rem" }}>
                        <input
                          type="checkbox"
                          checked={selectedAssociations.includes(idx)}
                          onChange={() => toggleAssociationSelection(idx)}
                          style={{ marginTop: "0.25rem" }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: "#1e40af", marginBottom: "0.25rem" }}>
                            {assoc.regulationNombre}
                          </div>
                          <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                            Reglamento N°{assoc.regulationId}
                          </div>
                        </div>
                      </div>

                      <div className="form-group" style={{ marginTop: "0.75rem" }}>
                        <label style={{ fontSize: "0.85rem" }}>Requisito Normativo Extraído</label>
                        <textarea
                          value={associationEditValues[idx] || assoc.requisitos}
                          onChange={(e) => handleAssociationEdit(idx, e.target.value)}
                          style={{
                            minHeight: "70px",
                            opacity: selectedAssociations.includes(idx) ? 1 : 0.6,
                            pointerEvents: selectedAssociations.includes(idx) ? "auto" : "none"
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{
                padding: "2rem",
                textAlign: "center",
                backgroundColor: "#f9fafb",
                borderRadius: "8px",
                color: "#64748b",
                marginBottom: "1.5rem"
              }}>
                <p>No se detectaron asociaciones con los reglamentos existentes.</p>
                <p style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>Aún así, puedes guardar el documento para revisión manual.</p>
              </div>
            )}

            <div className="btn-group">
              <button
                className="btn btn-primary"
                onClick={handleConfirmAssociations}
              >
                Confirmar y Aplicar
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowAssociationModal(false);
                  setPendingNormativa(null);
                  setSelectedAssociations([]);
                  setAssociationEditValues({});
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Normativas List */}
      <div className="card">
        <h3 className="section-title">Documentos Cargados</h3>

        {normativas && normativas.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Fecha</th>
                  <th>Reglamentos Asociados</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {normativas.map((normativa) => (
                  <React.Fragment key={normativa.id}>
                    <tr style={{
                      cursor: "pointer",
                      backgroundColor: expandedId === normativa.id ? "#f0f9ff" : ""
                    }}>
                      <td
                        onClick={() => setExpandedId(expandedId === normativa.id ? null : normativa.id)}
                        style={{ fontWeight: 500 }}
                      >
                        {expandedId === normativa.id ? "▼" : "▶"} {normativa.nombre}
                      </td>
                      <td>
                        <span className="badge">{normativa.tipo}</span>
                      </td>
                      <td style={{ fontSize: "0.9rem", color: "#64748b" }}>{normativa.fecha}</td>
                      <td>
                        <span className="badge" style={{
                          backgroundColor: normativa.regulacionesAsociadas?.length > 0 ? "#10b981" : "#d1d5db"
                        }}>
                          {normativa.regulacionesAsociadas?.length || 0}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeleteNormativa(normativa.id)}
                          style={{ padding: "0.25rem 0.75rem", fontSize: "0.85rem" }}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>

                    {expandedId === normativa.id && (
                      <tr style={{ backgroundColor: "#f9fafb" }}>
                        <td colSpan="5" style={{ padding: "1rem" }}>
                          <div>
                            <div style={{ marginBottom: "1rem" }}>
                              <h4 style={{ marginBottom: "0.5rem", fontSize: "0.95rem", fontWeight: 600 }}>Resumen</h4>
                              <p style={{ fontSize: "0.85rem", color: "#475569", lineHeight: "1.5" }}>
                                {normativa.resumen}
                              </p>
                            </div>

                            {normativa.regulacionesAsociadas && normativa.regulacionesAsociadas.length > 0 && (
                              <div>
                                <h4 style={{ marginBottom: "0.75rem", fontSize: "0.95rem", fontWeight: 600 }}>Reglamentos Asociados</h4>
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                  {normativa.regulacionesAsociadas.map((assoc, idx) => (
                                    <div
                                      key={idx}
                                      style={{
                                        padding: "0.75rem",
                                        backgroundColor: "#ffffff",
                                        border: "1px solid #e5e7eb",
                                        borderRadius: "4px"
                                      }}
                                    >
                                      <div style={{ fontWeight: 500, color: "#1e40af", marginBottom: "0.25rem" }}>
                                        {assoc.regulationNombre}
                                      </div>
                                      <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.5rem" }}>
                                        Reglamento N°{assoc.regulationId}
                                      </div>
                                      <div style={{ fontSize: "0.85rem", color: "#475569", fontStyle: "italic" }}>
                                        {assoc.requisitos}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {(!normativa.regulacionesAsociadas || normativa.regulacionesAsociadas.length === 0) && (
                              <div style={{
                                padding: "0.75rem",
                                backgroundColor: "#fef3c7",
                                borderRadius: "4px",
                                fontSize: "0.85rem",
                                color: "#92400e"
                              }}>
                                No hay asociaciones detectadas para este documento.
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{
            padding: "2rem",
            textAlign: "center",
            backgroundColor: "#f9fafb",
            borderRadius: "8px",
            color: "#64748b"
          }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>📋</div>
            <p>No hay documentos normativos cargados aún.</p>
            <p style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>Sube un PDF para comenzar a registrar normativa.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Normativa;
