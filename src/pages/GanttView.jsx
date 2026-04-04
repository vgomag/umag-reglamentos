import React, { useState, useMemo } from 'react';

// ── Datos completos de la Carta Gantt ──
const MESES = [
  "Abr 2026","May 2026","Jun 2026","Jul 2026","Ago 2026","Sep 2026",
  "Oct 2026","Nov 2026","Dic 2026","Ene 2027","Feb 2027","Mar 2027",
  "Abr 2027","May 2027","Jun 2027"
];

const HITOS = [
  {
    id: "H0", nombre: "H0 — Urgencias Legales", color: "#E74C3C",
    items: [
      { num: "29", nombre: "Compatibilidad Estudios–Vida Familiar", start: 0, end: 2, color: "#E74C3C", dep: null },
      { num: "18", nombre: "Reglamento General de Estudiantes", start: 0, end: 2, color: "#3498DB", dep: null },
      { num: "27", nombre: "Normativa Relativa para la Emisión de Normas", start: 0, end: 2, color: "#95A5A6", dep: "#7" },
    ]
  },
  {
    id: "H1", nombre: "H1 — Decisiones Estructurales", color: "#8E44AD",
    items: [
      { num: "8/11", nombre: "Fusión Facultades + Estructuras Académicas", start: 0, end: 1, color: "#8E44AD", dep: null },
      { num: "13/15", nombre: "Fusión Carrera Académica + Jerarquía", start: 0, end: 1, color: "#8E44AD", dep: null },
    ]
  },
  {
    id: "H2", nombre: "H2 — Estructura Académica", color: "#F39C12",
    items: [
      { num: "11", nombre: "Reglamento de Estructuras Académicas", start: 2, end: 5, color: "#F39C12", dep: "H1" },
      { num: "8", nombre: "Reglamento General de Facultades", start: 2, end: 5, color: "#F39C12", dep: "H1" },
      { num: "12", nombre: "Reglamento del Comité de Aseg. Calidad", start: 2, end: 5, color: "#F39C12", dep: null },
      { num: "9", nombre: "Reglamento de Gestión y Aseg. Calidad", start: 3, end: 5, color: "#F39C12", dep: "#12" },
      { num: "25", nombre: "Reglamento de Orden, Higiene y Seguridad", start: 2, end: 4, color: "#F39C12", dep: null },
    ]
  },
  {
    id: "H3", nombre: "H3 — Carrera y RRHH", color: "#3498DB",
    items: [
      { num: "13", nombre: "Reglamento de Carrera Académica", start: 5, end: 8, color: "#3498DB", dep: "#8, #11" },
      { num: "15", nombre: "Reglamento de Jerarquía Académica", start: 5, end: 8, color: "#3498DB", dep: null },
      { num: "16", nombre: "Reglamento de Promoción de un Académico", start: 7, end: 8, color: "#3498DB", dep: "#13, #15" },
      { num: "3", nombre: "Reglamento de Elección del Rector o Rectora", start: 5, end: 7, color: "#3498DB", dep: "#6" },
      { num: "2", nombre: "Declaración de Bienes de Especial Interés", start: 5, end: 7, color: "#3498DB", dep: null },
    ]
  },
  {
    id: "H4", nombre: "H4 — Financiero y Patrimonio", color: "#1ABC9C",
    items: [
      { num: "22", nombre: "Reglamento sobre Admin. Financiera", start: 6, end: 9, color: "#1ABC9C", dep: null },
      { num: "28", nombre: "Reglamento de Tramitación Convenios", start: 7, end: 9, color: "#1ABC9C", dep: "#22, #7" },
      { num: "23", nombre: "Reglamento sobre Propiedad Intelectual", start: 6, end: 9, color: "#1ABC9C", dep: null },
      { num: "24", nombre: "Protocolo de Protección de Datos", start: 6, end: 8, color: "#1ABC9C", dep: null },
      { num: "19", nombre: "Reglamento para Uso de Bienes y Servicios", start: 8, end: 9, color: "#1ABC9C", dep: "#22" },
    ]
  },
  {
    id: "H5", nombre: "H5 — Estudiantil y Convivencia", color: "#2ECC71",
    items: [
      { num: "10", nombre: "Reglamento de Estudios", start: 9, end: 11, color: "#2ECC71", dep: "#8, #11, #9" },
      { num: "21", nombre: "Reglamento del Consejo de Convivencia", start: 9, end: 11, color: "#2ECC71", dep: "#18" },
      { num: "26", nombre: "Normativa del Mediador Universitario", start: 9, end: 11, color: "#2ECC71", dep: null },
      { num: "31", nombre: "Reglamento de Votaciones Bienestar", start: 9, end: 10, color: "#2ECC71", dep: "#6" },
    ]
  },
  {
    id: "H6", nombre: "H6 — Cierre y Consolidación", color: "#E67E22",
    items: [
      { num: "17", nombre: "Reglamento Estímulos e Incentivos", start: 11, end: 13, color: "#E67E22", dep: "#22" },
      { num: "30", nombre: "Reglamento de Incentivo al Retiro", start: 11, end: 13, color: "#E67E22", dep: "#22" },
    ]
  },
];

const YA_APROBADOS = [
  { num: "1", nombre: "Estatuto UMAG (DFL 27/2024)" },
  { num: "4", nombre: "Reglamento del Consejo Superior" },
  { num: "5", nombre: "Reglamento del Consejo Universitario" },
  { num: "6", nombre: "Reglamento del Consejo de la Sociedad Civil" },
  { num: "7", nombre: "Reglamento de Contraloría Interna" },
  { num: "14", nombre: "Reglamento de Evaluación Académica" },
  { num: "20", nombre: "Reglamento de Contratación y Adquisiciones" },
];

const COLOR_LABELS = [
  { color: "#E74C3C", label: "Urgente" },
  { color: "#3498DB", label: "En Proceso" },
  { color: "#F39C12", label: "En Revisión" },
  { color: "#95A5A6", label: "Planificado" },
  { color: "#27AE60", label: "Aprobado" },
  { color: "#8E44AD", label: "Decisión" },
  { color: "#1ABC9C", label: "Financiero" },
  { color: "#2ECC71", label: "Estudiantil" },
  { color: "#E67E22", label: "Cierre" },
];

export default function GanttView({ regulations }) {
  const [selectedHito, setSelectedHito] = useState(null);
  const [hoveredItem, setHoveredItem] = useState(null);

  // Sync live estado from regulations data
  const getRegEstado = (num) => {
    const clean = String(parseInt(num));
    const reg = regulations.find(r => String(r.numero) === clean);
    return reg ? reg.estado : null;
  };

  const getRegProgreso = (num) => {
    const clean = String(parseInt(num));
    const reg = regulations.find(r => String(r.numero) === clean);
    return reg ? reg.progreso : 0;
  };

  // Current month marker
  const currentMonth = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth(); // 0-based
    // Abr 2026 = index 0 → year=2026, month=3
    const baseYear = 2026;
    const baseMonth = 3; // April
    const idx = (y - baseYear) * 12 + (m - baseMonth);
    return idx >= 0 && idx < 15 ? idx : -1;
  }, []);

  // Stats
  const totalItems = HITOS.reduce((s, h) => s + h.items.length, 0);
  const aprobadosCount = YA_APROBADOS.length;

  const visibleHitos = selectedHito ? HITOS.filter(h => h.id === selectedHito) : HITOS;

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Carta Gantt Interactiva</h2>
        <p>Cronograma de 15 meses — Abril 2026 a Junio 2027</p>
      </div>

      {/* KPIs */}
      <div className="gantt-kpis">
        <div className="gantt-kpi">
          <div className="gantt-kpi-value">{totalItems + aprobadosCount}</div>
          <div className="gantt-kpi-label">Reglamentos</div>
        </div>
        <div className="gantt-kpi" style={{ borderLeftColor: '#27AE60' }}>
          <div className="gantt-kpi-value" style={{ color: '#27AE60' }}>{aprobadosCount}</div>
          <div className="gantt-kpi-label">Ya Aprobados</div>
        </div>
        <div className="gantt-kpi" style={{ borderLeftColor: '#3498DB' }}>
          <div className="gantt-kpi-value" style={{ color: '#3498DB' }}>{totalItems}</div>
          <div className="gantt-kpi-label">Por Desarrollar</div>
        </div>
        <div className="gantt-kpi" style={{ borderLeftColor: '#8E44AD' }}>
          <div className="gantt-kpi-value" style={{ color: '#8E44AD' }}>7</div>
          <div className="gantt-kpi-label">Hitos</div>
        </div>
        <div className="gantt-kpi" style={{ borderLeftColor: '#F39C12' }}>
          <div className="gantt-kpi-value" style={{ color: '#F39C12' }}>15</div>
          <div className="gantt-kpi-label">Meses</div>
        </div>
      </div>

      {/* Leyenda de colores */}
      <div className="gantt-legend">
        {COLOR_LABELS.map(c => (
          <div key={c.label} className="gantt-legend-item">
            <div className="gantt-legend-dot" style={{ background: c.color }} />
            <span>{c.label}</span>
          </div>
        ))}
      </div>

      {/* Filtro por hito */}
      <div className="gantt-filter">
        <button className={`gantt-filter-btn ${!selectedHito ? 'active' : ''}`} onClick={() => setSelectedHito(null)}>
          Todos
        </button>
        {HITOS.map(h => (
          <button key={h.id} className={`gantt-filter-btn ${selectedHito === h.id ? 'active' : ''}`}
            onClick={() => setSelectedHito(selectedHito === h.id ? null : h.id)}
            style={selectedHito === h.id ? { background: h.color, borderColor: h.color, color: '#fff' } : {}}>
            {h.id}
          </button>
        ))}
      </div>

      {/* Chart container */}
      <div className="gantt-chart-wrapper">
        <div className="gantt-chart">
          {/* Header with months */}
          <div className="gantt-header">
            <div className="gantt-label-col">Reglamento</div>
            <div className="gantt-timeline-header">
              {MESES.map((m, i) => (
                <div key={i} className={`gantt-month-header ${i === currentMonth ? 'current' : ''}`}>
                  {m}
                </div>
              ))}
            </div>
          </div>

          {/* Hitos */}
          {visibleHitos.map(hito => (
            <div key={hito.id} className="gantt-hito-group">
              <div className="gantt-hito-title" style={{ borderLeftColor: hito.color }}>
                <span className="gantt-hito-badge" style={{ background: hito.color }}>{hito.id}</span>
                {hito.nombre.replace(`${hito.id} — `, '')}
              </div>
              {hito.items.map((item, idx) => {
                const estado = getRegEstado(item.num);
                const progreso = getRegProgreso(item.num);
                const isHovered = hoveredItem === `${hito.id}-${idx}`;
                return (
                  <div key={idx} className={`gantt-row ${isHovered ? 'hovered' : ''}`}
                    onMouseEnter={() => setHoveredItem(`${hito.id}-${idx}`)}
                    onMouseLeave={() => setHoveredItem(null)}>
                    <div className="gantt-label-col">
                      <span className="gantt-item-num">#{item.num}</span>
                      <span className="gantt-item-name" title={item.nombre}>{item.nombre}</span>
                      {estado && <span className={`badge ${estado.toLowerCase().replace(/\s+/g, '-')}`} style={{ fontSize: '0.6rem', padding: '0.05rem 0.3rem', marginLeft: '0.3rem' }}>{estado}</span>}
                    </div>
                    <div className="gantt-timeline">
                      {MESES.map((_, mi) => (
                        <div key={mi} className={`gantt-cell ${mi === currentMonth ? 'current-col' : ''}`}>
                          {mi >= item.start && mi <= item.end && (
                            <div className="gantt-bar"
                              style={{
                                background: item.color,
                                borderRadius: mi === item.start && mi === item.end ? '4px' : mi === item.start ? '4px 0 0 4px' : mi === item.end ? '0 4px 4px 0' : '0',
                                opacity: isHovered ? 1 : 0.85,
                              }}>
                              {mi === item.start && (
                                <span className="gantt-bar-label">
                                  #{item.num}
                                  {progreso > 0 && <span className="gantt-bar-pct"> {progreso}%</span>}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                      {/* Dependency arrow indicator */}
                      {item.dep && isHovered && (
                        <div className="gantt-dep-tooltip">Depende de: {item.dep}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {/* Ya Aprobados */}
          <div className="gantt-hito-group">
            <div className="gantt-hito-title" style={{ borderLeftColor: '#27AE60' }}>
              <span className="gantt-hito-badge" style={{ background: '#27AE60' }}>✓</span>
              Ya Aprobados
            </div>
            {YA_APROBADOS.map((item, idx) => (
              <div key={idx} className="gantt-row aprobado-row">
                <div className="gantt-label-col">
                  <span className="gantt-item-num">#{item.num}</span>
                  <span className="gantt-item-name" title={item.nombre}>{item.nombre}</span>
                  <span className="badge aprobado" style={{ fontSize: '0.6rem', padding: '0.05rem 0.3rem', marginLeft: '0.3rem' }}>Aprobado</span>
                </div>
                <div className="gantt-timeline">
                  {MESES.map((_, mi) => (
                    <div key={mi} className={`gantt-cell ${mi === currentMonth ? 'current-col' : ''}`}>
                      {mi === 0 && (
                        <div className="gantt-bar" style={{ background: '#27AE60', borderRadius: '4px', opacity: 0.75 }}>
                          <span className="gantt-bar-label">#{item.num} ✓</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
