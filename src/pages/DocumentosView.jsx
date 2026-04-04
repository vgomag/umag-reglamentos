import React, { useState } from 'react';
import PdfViewer from '../components/PdfViewer';

function DocumentosView({ regulations, onSelectRegulation }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  // Filtrar reglamentos que tienen PDF (pdfUrl, enlace, o adjunto PDF con url)
  const regsWithPdf = regulations.filter(r => {
    const hasPdf = r.pdfUrl
      || (r.enlace && r.enlace.toLowerCase().endsWith('.pdf'))
      || (r.adjuntos || []).some(a => a.type === 'application/pdf' && a.url);
    return hasPdf;
  });

  const filtered = regsWithPdf.filter(r => {
    const matchSearch = !searchTerm
      || r.nombre.toLowerCase().includes(searchTerm.toLowerCase())
      || (r.responsable || '').toLowerCase().includes(searchTerm.toLowerCase())
      || (r.decreto || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchEstado = !filterEstado || r.estado === filterEstado;
    return matchSearch && matchEstado;
  });

  const getPdfUrl = (r) => {
    return r.pdfUrl
      || ((r.adjuntos || []).find(a => a.type === 'application/pdf' && a.url) || {}).url
      || r.enlace
      || null;
  };

  return (
    <div className="page-content">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Documentos Publicados</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 0' }}>
            {regsWithPdf.length} reglamento{regsWithPdf.length !== 1 ? 's' : ''} con documento PDF cargado
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Buscar por nombre, responsable..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="filter-select"
            style={{ minWidth: '220px' }}
          />
          <select className="filter-select" value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            <option>Pendiente</option>
            <option>En Proceso</option>
            <option>En Revisión</option>
            <option>Aprobado</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📂</div>
          <p style={{ fontSize: '1rem', fontWeight: 500 }}>
            {regsWithPdf.length === 0 ? 'Aún no hay documentos PDF cargados' : 'Sin resultados para el filtro aplicado'}
          </p>
          <p style={{ fontSize: '0.85rem' }}>
            {regsWithPdf.length === 0
              ? 'Sube un PDF desde el detalle de cualquier reglamento para verlo aquí.'
              : 'Prueba con otros términos de búsqueda.'}
          </p>
        </div>
      ) : (
        <div className="documentos-list">
          {filtered.map(r => {
            const pdfUrl = getPdfUrl(r);
            const isExpanded = expandedId === r.id;
            const estadoCls = (r.estado || 'pendiente').toLowerCase().replace(/\s+/g, '-');
            const pdfAttachments = (r.adjuntos || []).filter(a => a.type === 'application/pdf');

            return (
              <div key={r.id} className="documento-card">
                {/* Card header — siempre visible */}
                <div className="documento-card-header" onClick={() => setExpandedId(isExpanded ? null : r.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                    <div className="documento-icon">📄</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="documento-nombre">{r.numero ? `${r.numero}. ` : ''}{r.nombre}</div>
                      <div className="documento-meta">
                        {r.responsable && <span>{r.responsable}</span>}
                        {r.decreto && <span>{r.decreto}</span>}
                        {pdfAttachments.length > 0 && <span>{pdfAttachments.length} PDF{pdfAttachments.length > 1 ? 's' : ''}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                    <span className={`badge ${estadoCls}`}>{r.estado}</span>
                    <div className="documento-progress-mini">
                      <div className="documento-progress-bar" style={{
                        width: `${r.progreso || 0}%`,
                        background: (r.progreso || 0) >= 75 ? '#10b981' : (r.progreso || 0) >= 40 ? '#f59e0b' : '#94a3b8'
                      }} />
                    </div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', minWidth: '32px', textAlign: 'right' }}>{r.progreso || 0}%</span>
                    <span className="documento-expand-icon" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▾</span>
                  </div>
                </div>

                {/* Expandido: visor PDF + resumen */}
                {isExpanded && pdfUrl && (
                  <div className="documento-card-body">
                    <PdfViewer pdfUrl={pdfUrl} regulation={r} compact={true} />
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                      <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => onSelectRegulation(r)}>
                        Ver detalle completo →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default DocumentosView;
