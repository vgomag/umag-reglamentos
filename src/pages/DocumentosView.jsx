import React, { useState } from 'react';
import PdfViewer from '../components/PdfViewer';

// Archivos descargables
const DESCARGAS = [
  { nombre: "Carta Gantt — Normativa UMAG", archivo: "/documentos/Gantt_Normativa_UMAG.xlsx", tipo: "xlsx", desc: "Cronograma de 15 meses con barras por estado y 7 hitos" },
  { nombre: "Planificación Normativa UMAG", archivo: "/documentos/Planificacion_Normativa_UMAG.xlsx", tipo: "xlsx", desc: "Resumen ejecutivo, requisitos legales, mapa de dependencias, hitos y plazos" },
];

const BORRADORES_DOCX = [
  { num: "02", nombre: "Declaración de Bienes de Especial Interés Institucional" },
  { num: "03", nombre: "Reglamento de Elección del Rector o Rectora" },
  { num: "08", nombre: "Reglamento General de Facultades" },
  { num: "09", nombre: "Reglamento de Gestión, Evaluación y Aseguramiento de la Calidad" },
  { num: "10", nombre: "Reglamento de Estudios" },
  { num: "11", nombre: "Reglamento de Estructuras Académicas" },
  { num: "12", nombre: "Reglamento del Comité de Aseguramiento de la Calidad" },
  { num: "13", nombre: "Reglamento de Carrera Académica" },
  { num: "15", nombre: "Reglamento de Jerarquía Académica" },
  { num: "16", nombre: "Reglamento de Promoción de un Académico" },
  { num: "17", nombre: "Reglamento de Estímulos e Incentivos a Funcionarios de Apoyo" },
  { num: "18", nombre: "Reglamento General de Estudiantes" },
  { num: "19", nombre: "Reglamento para Uso de Bienes y Servicios" },
  { num: "21", nombre: "Reglamento del Consejo de Convivencia Universitaria" },
  { num: "22", nombre: "Reglamento sobre Administración Financiera y Patrimonial" },
  { num: "23", nombre: "Reglamento sobre Propiedad Intelectual" },
  { num: "24", nombre: "Protocolo de Protección de Datos" },
  { num: "25", nombre: "Reglamento de Orden, Higiene y Seguridad" },
  { num: "26", nombre: "Normativa del Mediador Universitario" },
  { num: "27", nombre: "Normativa Relativa para la Emisión de Normas" },
  { num: "28", nombre: "Reglamento de Tramitación de Convenios y Contratos" },
  { num: "29", nombre: "Normativa de Compatibilidad Estudios con Vida Familiar" },
  { num: "30", nombre: "Reglamento de Incentivo al Retiro" },
  { num: "31", nombre: "Reglamento de Votaciones Bienestar" },
];

function DocumentosView({ regulations, onSelectRegulation }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [activeTab, setActiveTab] = useState('visor');

  // Filtrar reglamentos que tienen PDF (pdfUrl, enlace, o adjunto PDF con url/blobUrl)
  const regsWithPdf = regulations.filter(r => {
    const hasPdf = r.pdfUrl
      || (r.enlace && (r.enlace.toLowerCase().endsWith('.pdf') || r.enlace.includes('drive.google.com')))
      || (r.adjuntos || []).some(a => a.type === 'application/pdf' && (a.url || a.blobUrl));
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
    if (r.pdfUrl) return r.pdfUrl;
    const pdfAdj = (r.adjuntos || []).find(a => a.type === 'application/pdf' && (a.url || a.blobUrl));
    if (pdfAdj) return pdfAdj.url || pdfAdj.blobUrl;
    return r.enlace || null;
  };

  return (
    <div className="page-content">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Documentos</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 0' }}>
            Borradores, planificación y documentos del proyecto normativo
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.25rem', borderBottom: '2px solid #e5e7eb', paddingBottom: 0 }}>
        {[
          { id: 'visor', label: 'Visor PDF', count: regsWithPdf.length },
          { id: 'descargas', label: 'Descargas', count: DESCARGAS.length + BORRADORES_DOCX.length }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '0.6rem 1.25rem', fontSize: '0.85rem', fontWeight: 600, border: 'none', cursor: 'pointer',
            borderBottom: activeTab === tab.id ? '2px solid #1a56db' : '2px solid transparent',
            marginBottom: '-2px', borderRadius: '6px 6px 0 0',
            background: activeTab === tab.id ? '#eff6ff' : 'transparent',
            color: activeTab === tab.id ? '#1a56db' : '#64748b'
          }}>
            {tab.label} <span style={{ fontSize: '0.75rem', background: activeTab === tab.id ? '#dbeafe' : '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: 99, marginLeft: '0.3rem' }}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Tab: Descargas */}
      {activeTab === 'descargas' && (
        <div>
          {/* Planificación */}
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>Planificación y Carta Gantt</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem', marginBottom: '2rem' }}>
            {DESCARGAS.map(d => (
              <a key={d.archivo} href={d.archivo} download style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, transition: 'box-shadow 0.2s' }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>📊</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1e293b' }}>{d.nombre}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{d.desc}</div>
                </div>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#059669', background: '#dcfce7', padding: '0.15rem 0.5rem', borderRadius: 4, textTransform: 'uppercase' }}>{d.tipo}</span>
              </a>
            ))}
          </div>

          {/* Borradores Word */}
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>Borradores de Reglamentos (Word)</h3>
          <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.75rem' }}>24 borradores con estructura completa, artículos redactados según DFL 27/2024</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.5rem' }}>
            {BORRADORES_DOCX.map(b => {
              const reg = regulations.find(r => r.numero === String(parseInt(b.num)));
              const estadoCls = reg ? (reg.estado || 'pendiente').toLowerCase().replace(/\s+/g, '-') : '';
              return (
                <a key={b.num} href={`/documentos/Borrador_Reglamento_${b.num}_${b.nombre.replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ0-9 ]/g, '').replace(/\s+/g, '_').substring(0, 50)}.docx`} download style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.7rem 0.85rem', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 6, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', flexShrink: 0, color: '#1d4ed8', fontWeight: 700 }}>{b.num}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 500, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.nombre}</div>
                  </div>
                  {reg && <span className={`badge ${estadoCls}`} style={{ fontSize: '0.65rem', flexShrink: 0 }}>{reg.estado}</span>}
                  <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#1d4ed8', background: '#dbeafe', padding: '0.1rem 0.35rem', borderRadius: 3 }}>DOCX</span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: Visor PDF */}
      {activeTab === 'visor' && (
      <>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
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
      </>
      )}
    </div>
  );
}

export default DocumentosView;
