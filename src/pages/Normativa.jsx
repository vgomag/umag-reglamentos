import React, { useState, useRef } from 'react';
import { sanitizePdfText } from '../utils/sanitize';
import { extractPdfText } from '../utils/pdf';

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

  // Escape special regex characters in a string
  const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Extract metadata from the PDF: norm name, articles, deadlines
  const extractNormMetadata = (textoExtraido) => {
    const meta = {};

    // Detect norm name/title (Ley, Decreto, Resolución, Estatuto)
    const normPatterns = [
      /(?:LEY\s+(?:N[°º]?\s*)?\d[\d.]*)/gi,
      /(?:DECRETO\s+(?:(?:EXENTO|UNIVERSITARIO|SUPREMO)\s+)?(?:N[°º]?\s*)?\d[\d\/\-]*(?:\/SU\/\d{4})?)/gi,
      /(?:DFL\s+(?:N[°º]?\s*)?\d[\d.]*)/gi,
      /(?:RESOLUCI[OÓ]N\s+(?:EXENTA?\s+)?(?:N[°º]?\s*)?\d[\d\/\-]*)/gi,
      /(?:ESTATUTO\s+(?:DE\s+LA\s+)?(?:UNIVERSIDAD|UMAG)[^.]{0,60})/gi
    ];
    for (const p of normPatterns) {
      const m = textoExtraido.match(p);
      if (m) { meta.norma = m[0].replace(/\s+/g, ' ').trim(); break; }
    }
    if (!meta.norma) {
      // Try generic title detection
      const titleMatch = textoExtraido.match(/(?:REGLAMENTO|NORMATIVA|ORDENANZA)\s+[A-ZÁÉÍÓÚÑ\s,]+/i);
      if (titleMatch && titleMatch[0].length > 10) {
        meta.norma = titleMatch[0].replace(/\s+/g, ' ').trim().substring(0, 120);
      }
    }

    // Extract ALL articles mentioned in the document
    const articulosSet = new Set();
    const artPatterns = [
      /Art(?:[ií]culo)?\.?\s*(\d+(?:\s*°)?(?:\s*(?:bis|ter|qu[aá]ter|inciso\s+\w+|letra\s+\w\)|[,y]\s*\d+)*))/gi,
      /art[ií]culos?\s+(\d+(?:\s*(?:al?|y|,)\s*\d+)*)/gi
    ];
    for (const p of artPatterns) {
      let match;
      while ((match = p.exec(textoExtraido)) !== null) {
        articulosSet.add(match[0].replace(/\s+/g, ' ').trim());
      }
    }
    meta.articulos = [...articulosSet];

    // Extract deadlines/plazos
    const plazos = [];
    const plazoPatterns = [
      /(?:plazo\s+(?:de\s+|m[aá]ximo\s+(?:de\s+)?)?(?:\d+\s+(?:d[ií]as?|meses?|a[ñn]os?)(?:\s+(?:h[aá]biles?|corridos?|calendarios?))?)[^.]{0,80})/gi,
      /(?:dentro\s+(?:del?\s+)?(?:plazo\s+(?:de\s+)?)?\d+\s+(?:d[ií]as?|meses?|a[ñn]os?)[^.]{0,60})/gi,
      /(?:(?:antes\s+del?|hasta\s+el?|a\s+m[aá]s\s+tardar\s+el?)\s+\d{1,2}\s+de\s+\w+\s+(?:de\s+|del?\s+)?\d{4})/gi,
      /(?:\d+\s+(?:d[ií]as?|meses?|a[ñn]os?)\s+(?:h[aá]biles?|corridos?|calendarios?)\s+(?:desde|contados?\s+desde|a\s+(?:contar|partir)\s+de)[^.]{0,80})/gi
    ];
    for (const p of plazoPatterns) {
      let match;
      while ((match = p.exec(textoExtraido)) !== null) {
        const plazoText = match[0].replace(/\s+/g, ' ').trim();
        if (!plazos.some(pl => pl.includes(plazoText) || plazoText.includes(pl))) {
          plazos.push(plazoText);
        }
      }
    }
    meta.plazos = plazos;

    return meta;
  };

  // For a given regulation, extract the specific articles and requirements from the text
  const extractRequisitoDetallado = (textoExtraido, reg, normMeta) => {
    const textoLower = textoExtraido.toLowerCase();
    const resultado = { articulos: [], requisitos: [], plazos: [] };

    // Find the search term that matched this regulation
    let searchTerms = [];
    if (reg.nombre) {
      searchTerms.push(reg.nombre);
      // Also add key fragments
      const keywords = reg.nombre.split(/\s+/).filter(w => w.length > 4).map(w => w.toLowerCase());
      searchTerms.push(...keywords);
    }
    if (reg.numero) searchTerms.push(String(reg.numero));

    // For each search term, find surrounding articles
    for (const term of searchTerms) {
      try {
        // indexOf trabaja con texto literal, NO con regex — no escapar aquí
        const pos = textoLower.indexOf(term.toLowerCase());
        if (pos === -1) continue;

        // Look for articles in a window of 500 chars around the match
        const windowStart = Math.max(0, pos - 300);
        const windowEnd = Math.min(textoExtraido.length, pos + term.length + 500);
        const window = textoExtraido.substring(windowStart, windowEnd);

        // Extract articles from this window
        const artMatch = window.match(/Art(?:[ií]culo)?\.?\s*\d+[^.]*\./gi);
        if (artMatch) {
          artMatch.forEach(a => {
            const cleaned = a.replace(/\s+/g, ' ').trim();
            if (!resultado.articulos.includes(cleaned)) resultado.articulos.push(cleaned);
          });
        }

        // Extract the full sentence/paragraph containing the term as "requisito"
        const sentenceRegex = new RegExp(`[^.]*${escapeRegex(term)}[^.]*\\.`, 'gi');
        const sentMatches = textoExtraido.match(sentenceRegex);
        if (sentMatches) {
          sentMatches.slice(0, 3).forEach(s => {
            const cleaned = s.replace(/\s+/g, ' ').trim();
            if (cleaned.length > 15 && !resultado.requisitos.some(r => r === cleaned)) {
              resultado.requisitos.push(cleaned);
            }
          });
        }

        // Extract plazos from this window
        const plazoMatch = window.match(/(?:plazo|dentro|antes|hasta|d[ií]as?|meses?)[^.]*\./gi);
        if (plazoMatch) {
          plazoMatch.forEach(p => {
            const cleaned = p.replace(/\s+/g, ' ').trim();
            if (cleaned.length > 10 && !resultado.plazos.includes(cleaned)) resultado.plazos.push(cleaned);
          });
        }
      } catch (e) { /* ignore regex errors */ }
    }

    // If no specific articles found, use global ones from the norm
    if (resultado.articulos.length === 0 && normMeta.articulos.length > 0) {
      resultado.articulos = normMeta.articulos.slice(0, 5);
    }

    // If no specific plazos, use global ones
    if (resultado.plazos.length === 0 && normMeta.plazos.length > 0) {
      resultado.plazos = normMeta.plazos;
    }

    return resultado;
  };

  // Auto-detect associations with existing regulations
  const detectAssociations = (textoExtraido, normMeta) => {
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

      // Check for regulation name matches
      if (reg.nombre) {
        try {
          const fullNameRegex = new RegExp(escapeRegex(reg.nombre), 'gi');
          const found = textoExtraido.match(fullNameRegex);
          if (found) matches.push(...found);
        } catch (e) { /* ignore */ }

        if (matches.length === 0) {
          const keywords = reg.nombre.split(/\s+/).filter(w => w.length > 3).map(w => w.toLowerCase());
          const matchedKeywords = keywords.filter(kw => textoLower.includes(kw));
          if (keywords.length >= 2 && matchedKeywords.length >= Math.ceil(keywords.length * 0.6)) {
            matches.push(reg.nombre);
          }
        }
      }

      if (matches.length > 0) {
        const detalle = extractRequisitoDetallado(textoExtraido, reg, normMeta);

        // Build structured requisito text
        let requisito = '';

        if (detalle.articulos.length > 0) {
          requisito += `Artículos: ${detalle.articulos.join(' | ')}\n\n`;
        }

        if (detalle.requisitos.length > 0) {
          requisito += `Requisitos:\n${detalle.requisitos.map(r => `• ${r}`).join('\n')}\n\n`;
        } else {
          // Fallback: extract context around the match
          let context = '';
          if (reg.nombre) {
            try {
              const snippet = reg.nombre.substring(0, 20);
              const ctxRegex = new RegExp(`.{0,150}${escapeRegex(snippet)}.{0,150}`, 'gi');
              const ctxMatch = textoExtraido.match(ctxRegex);
              if (ctxMatch) context = ctxMatch[0].replace(/\s+/g, ' ').trim();
            } catch (e) { /* ignore */ }
          }
          requisito += `Requisitos:\n• ${context || 'Mención de ' + reg.nombre}\n\n`;
        }

        if (detalle.plazos.length > 0) {
          requisito += `Plazos:\n${detalle.plazos.map(p => `⏰ ${p}`).join('\n')}`;
        }

        associations.push({
          regulationId: reg.id,
          regulationNombre: reg.nombre,
          norma: normMeta.norma || '',
          articulos: detalle.articulos,
          plazos: detalle.plazos,
          requisitos: requisito.trim()
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

      // Sanitizar texto extraído para prevenir XSS
      const textoSeguro = sanitizePdfText(textoExtraido);

      // Step 2: Extract norm metadata (name, articles, deadlines)
      setExtractProgress('Analizando norma, artículos y plazos...');
      const normMeta = extractNormMetadata(textoSeguro);

      // Step 3: Detect associations with regulations
      setExtractProgress('Detectando asociaciones con reglamentos...');
      const regulacionesAsociadas = detectAssociations(textoSeguro, normMeta);

      // Step 4: Create resumen
      const cleanText = textoSeguro.replace(/\s+/g, ' ').trim();
      const normaInfo = normMeta.norma ? `[${normMeta.norma}] ` : '';
      const resumen = normaInfo + cleanText.substring(0, 300) + (cleanText.length > 300 ? '...' : '');

      // Step 5: Prepare normativa object
      const nombreFinal = documentName || file.name.replace('.pdf', '');
      const newNormativa = {
        id: Date.now(),
        nombre: nombreFinal,
        tipo: documentType,
        fecha: new Date().toLocaleDateString('es-CL'),
        textoExtraido: textoSeguro,
        resumen: resumen,
        norma: normMeta.norma || nombreFinal,
        articulosGlobales: normMeta.articulos,
        plazosGlobales: normMeta.plazos,
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
        const normaLabel = assoc.norma || normativaToAdd.norma || normativaToAdd.nombre;
        let obsEntry = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 NORMA: ${normaLabel}\nFuente: ${normativaToAdd.nombre} (${normativaToAdd.tipo})\nFecha carga: ${normativaToAdd.fecha}\n`;

        if (assoc.articulos && assoc.articulos.length > 0) {
          obsEntry += `\n📌 Artículos aplicables:\n${assoc.articulos.map(a => `   • ${a}`).join('\n')}\n`;
        }

        // Parse the requisitos field for the structured content
        const reqLines = (associationEditValues[pendingNormativa.regulacionesAsociadas.indexOf(assoc)] || assoc.requisitos || '').split('\n').filter(l => l.trim());
        const reqSection = reqLines.filter(l => !l.startsWith('Artículos:') && !l.startsWith('Plazos:') && !l.startsWith('⏰'));
        const plazoSection = reqLines.filter(l => l.startsWith('⏰'));

        if (reqSection.length > 0) {
          obsEntry += `\n📝 Requisitos:\n${reqSection.map(r => r.startsWith('•') || r.startsWith('Requisitos:') ? `   ${r}` : `   • ${r}`).join('\n')}\n`;
        }

        if (plazoSection.length > 0) {
          obsEntry += `\n⏰ Plazos:\n${plazoSection.map(p => `   ${p}`).join('\n')}\n`;
        } else if (assoc.plazos && assoc.plazos.length > 0) {
          obsEntry += `\n⏰ Plazos:\n${assoc.plazos.map(p => `   ⏰ ${p}`).join('\n')}\n`;
        }

        obsEntry += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

        updatesMap[assoc.regulationId] = {
          ...regulation,
          observaciones: baseObs + obsEntry
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
                    <div key={assoc.regulationId || idx} style={{
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
                          {assoc.norma && (
                            <div style={{ fontSize: "0.8rem", color: "#059669", fontWeight: 500, marginBottom: "0.15rem" }}>
                              Norma: {assoc.norma}
                            </div>
                          )}
                          {assoc.articulos && assoc.articulos.length > 0 && (
                            <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.15rem" }}>
                              Artículos: {assoc.articulos.slice(0, 3).join(', ')}{assoc.articulos.length > 3 ? ` (+${assoc.articulos.length - 3} más)` : ''}
                            </div>
                          )}
                          {assoc.plazos && assoc.plazos.length > 0 && (
                            <div style={{ fontSize: "0.8rem", color: "#d97706" }}>
                              ⏰ {assoc.plazos.length} plazo(s) detectado(s)
                            </div>
                          )}
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
                                        borderRadius: "6px"
                                      }}
                                    >
                                      <div style={{ fontWeight: 600, color: "#1e40af", marginBottom: "0.5rem", fontSize: "0.9rem" }}>
                                        {assoc.regulationNombre}
                                      </div>
                                      {assoc.norma && (
                                        <div style={{ fontSize: "0.8rem", color: "#059669", marginBottom: "0.35rem" }}>
                                          <strong>Norma:</strong> {assoc.norma}
                                        </div>
                                      )}
                                      {assoc.articulos && assoc.articulos.length > 0 && (
                                        <div style={{ fontSize: "0.8rem", color: "#475569", marginBottom: "0.35rem" }}>
                                          <strong>Artículos:</strong> {assoc.articulos.join(' | ')}
                                        </div>
                                      )}
                                      {assoc.plazos && assoc.plazos.length > 0 && (
                                        <div style={{ fontSize: "0.8rem", color: "#d97706", marginBottom: "0.35rem" }}>
                                          <strong>Plazos:</strong> {assoc.plazos.join(' | ')}
                                        </div>
                                      )}
                                      <div style={{ fontSize: "0.8rem", color: "#475569", whiteSpace: "pre-wrap", marginTop: "0.5rem", padding: "0.5rem", backgroundColor: "#f9fafb", borderRadius: "4px", borderLeft: "3px solid #3b82f6" }}>
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
