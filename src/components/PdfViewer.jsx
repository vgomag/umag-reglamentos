import React, { useState } from 'react';

/**
 * Convierte URLs de Google Drive al formato embebible.
 * - /file/d/ID/view  → /file/d/ID/preview
 * - /open?id=ID      → /file/d/ID/preview
 * - drive.google.com/... cualquier otra forma
 */
function getEmbedUrl(url) {
  if (!url) return null;

  // Google Drive: /file/d/FILE_ID/... → /file/d/FILE_ID/preview
  const driveFileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveFileMatch) {
    return `https://drive.google.com/file/d/${driveFileMatch[1]}/preview`;
  }

  // Google Drive: /open?id=FILE_ID
  const driveOpenMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (driveOpenMatch) {
    return `https://drive.google.com/file/d/${driveOpenMatch[1]}/preview`;
  }

  // Google Docs viewer for any external PDF that isn't Supabase/blob
  if (url.startsWith('http') && !url.startsWith('blob:') && !url.includes('supabase')) {
    // Use Google Docs viewer as fallback for external PDFs
    return `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
  }

  // Supabase or blob URLs work directly
  return url;
}

/**
 * PdfViewer — muestra un PDF embebido + panel de resumen con datos clave.
 * Props:
 *   pdfUrl        – URL del PDF (Supabase, blob, Google Drive, o enlace externo)
 *   regulation    – objeto del reglamento con sus campos
 *   compact       – si true, usa layout más pequeño (para vista DocumentosView)
 */
function PdfViewer({ pdfUrl, regulation, compact = false }) {
  const [iframeError, setIframeError] = useState(false);

  if (!pdfUrl) return null;

  const embedUrl = getEmbedUrl(pdfUrl);
  const originalUrl = pdfUrl;
  const estado = regulation.estado || 'Pendiente';
  const estadoCls = estado.toLowerCase().replace(/\s+/g, '-');
  const progreso = regulation.progreso ?? 0;

  const dataFields = [
    { label: 'N° Reglamento', value: regulation.numero },
    { label: 'Artículo Estatuto', value: regulation.articulo_estatuto || regulation.articulo },
    { label: 'Decreto', value: regulation.decreto },
    { label: 'Responsable', value: regulation.responsable },
    { label: 'Prioridad', value: regulation.prioridad },
    { label: 'Fecha documento', value: regulation.fecha_documento },
  ].filter(f => f.value);

  const resumen = regulation.resumenPdf || regulation.observaciones || null;

  return (
    <div className={`pdf-viewer-container ${compact ? 'pdf-viewer-compact' : ''}`}>
      {/* PDF embebido */}
      <div className="pdf-viewer-frame">
        {!iframeError ? (
          <iframe
            src={embedUrl}
            title={`PDF - ${regulation.nombre}`}
            className="pdf-iframe"
            allow="autoplay"
            onError={() => setIframeError(true)}
          />
        ) : (
          <div className="pdf-viewer-fallback">
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📄</div>
            <p>No se pudo cargar la vista previa del PDF.</p>
            <a href={originalUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
              Abrir PDF en nueva pestaña
            </a>
          </div>
        )}
      </div>

      {/* Panel de resumen */}
      <div className="pdf-viewer-summary">
        <div className="pdf-summary-header">
          <h4 className="pdf-summary-title">{compact ? regulation.nombre : 'Resumen del Documento'}</h4>
          <span className={`badge ${estadoCls}`}>{estado}</span>
        </div>

        {/* Barra de progreso */}
        <div className="pdf-summary-progress">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Avance</span>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: progreso >= 75 ? '#10b981' : progreso >= 40 ? '#f59e0b' : '#94a3b8' }}>{progreso}%</span>
          </div>
          <div style={{ height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${progreso}%`,
              background: progreso >= 75 ? '#10b981' : progreso >= 40 ? '#f59e0b' : '#94a3b8',
              borderRadius: 99,
              transition: 'width 0.4s ease'
            }} />
          </div>
        </div>

        {/* Datos clave */}
        <div className="pdf-summary-fields">
          {dataFields.map(f => (
            <div key={f.label} className="pdf-summary-field">
              <span className="pdf-summary-field-label">{f.label}</span>
              <span className="pdf-summary-field-value">{f.value}</span>
            </div>
          ))}
        </div>

        {/* Resumen textual */}
        {resumen && (
          <div className="pdf-summary-text">
            <span className="pdf-summary-field-label">Resumen</span>
            <p className="pdf-summary-excerpt">{resumen.length > 600 ? resumen.substring(0, 600) + '...' : resumen}</p>
          </div>
        )}

        {/* Adjuntos PDF listados */}
        {(regulation.adjuntos || []).filter(a => a.type === 'application/pdf').length > 1 && (
          <div className="pdf-summary-attachments">
            <span className="pdf-summary-field-label">Otros PDFs adjuntos</span>
            {regulation.adjuntos.filter(a => a.type === 'application/pdf' && (a.url || a.blobUrl) && (a.url || a.blobUrl) !== pdfUrl).map(a => (
              <a key={a.url || a.blobUrl || a.name} href={a.url || a.blobUrl} target="_blank" rel="noopener noreferrer" className="pdf-summary-link">
                📄 {a.name}
              </a>
            ))}
          </div>
        )}

        <a href={originalUrl} target="_blank" rel="noopener noreferrer" className="pdf-open-external">
          Abrir en nueva pestaña ↗
        </a>
      </div>
    </div>
  );
}

export default PdfViewer;
