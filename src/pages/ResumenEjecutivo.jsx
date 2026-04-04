import React from 'react';

const FECHA_LIMITE_REGLAMENTOS = "2026-05-12";
const FECHA_LIMITE_UNIDADES = "2025-08-12";

function calcDaysRemaining(targetDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

export default function ResumenEjecutivo({ regulations }) {
  const total = regulations.length;
  const aprobados = regulations.filter(r => r.estado === 'Aprobado').length;
  const enRevision = regulations.filter(r => r.estado === 'En Revisión').length;
  const enProceso = regulations.filter(r => r.estado === 'En Proceso').length;
  const pendientes = regulations.filter(r => r.estado === 'Pendiente').length;
  const faltantes = total - aprobados;
  const pctAprobado = total > 0 ? Math.round((aprobados / total) * 100) : 0;
  const avgProgress = total > 0 ? Math.round(regulations.reduce((s, r) => s + r.progreso, 0) / total) : 0;

  const diasRestantes = calcDaysRemaining(FECHA_LIMITE_REGLAMENTOS);
  const diasUnidades = calcDaysRemaining(FECHA_LIMITE_UNIDADES);

  const bannerClass = diasRestantes <= 30 ? 'critical' : diasRestantes <= 90 ? 'warning' : 'ok';
  const bannerIcon = diasRestantes <= 30 ? '🚨' : diasRestantes <= 90 ? '⚠️' : '✅';

  // Reglamentos en riesgo (no aprobados y con poco progreso)
  const enRiesgo = regulations
    .filter(r => r.estado !== 'Aprobado')
    .map(r => {
      const riskLevel = r.progreso < 15 ? 'critical' : r.progreso < 40 ? 'warning' : 'ok';
      return { ...r, riskLevel };
    })
    .sort((a, b) => a.progreso - b.progreso);

  const criticos = enRiesgo.filter(r => r.riskLevel === 'critical').length;
  const medios = enRiesgo.filter(r => r.riskLevel === 'warning').length;

  // Velocidad requerida
  const regsPerMonth = diasRestantes > 0 && faltantes > 0 ? (faltantes / (diasRestantes / 30)).toFixed(1) : 'N/A';

  // Progress ring SVG
  const ringSize = 160;
  const ringStroke = 12;
  const ringRadius = (ringSize - ringStroke) / 2;
  const ringCircum = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircum - (pctAprobado / 100) * ringCircum;

  // Por responsable - top 5 con más carga pendiente
  const byResp = {};
  regulations.filter(r => r.estado !== 'Aprobado').forEach(r => {
    const resp = r.responsable || 'Sin responsable';
    if (!byResp[resp]) byResp[resp] = 0;
    byResp[resp]++;
  });
  const topResponsables = Object.entries(byResp).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="page-content">
      {/* Hero con anillo de progreso */}
      <div className="resumen-hero" style={{ display: 'flex', alignItems: 'center', gap: '3rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280, position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.4)', marginBottom: '0.5rem' }}>Resumen Ejecutivo</div>
          <div className="resumen-hero-title" style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>Implementación Nuevo Estatuto</div>
          <div className="resumen-hero-subtitle" style={{ marginBottom: '1.5rem' }}>DFL Num. 27 — Diario Oficial, 12 de agosto de 2024</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '0.85rem 1rem', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>{total}</div>
              <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.5, marginTop: '0.2rem' }}>Total</div>
            </div>
            <div style={{ background: 'rgba(16,185,129,0.12)', borderRadius: 12, padding: '0.85rem 1rem', border: '1px solid rgba(16,185,129,0.15)' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#34d399', letterSpacing: '-0.03em', lineHeight: 1 }}>{aprobados}</div>
              <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.5, marginTop: '0.2rem' }}>Aprobados</div>
            </div>
            <div style={{ background: 'rgba(251,191,36,0.12)', borderRadius: 12, padding: '0.85rem 1rem', border: '1px solid rgba(251,191,36,0.15)' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fbbf24', letterSpacing: '-0.03em', lineHeight: 1 }}>{faltantes}</div>
              <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.5, marginTop: '0.2rem' }}>Por Aprobar</div>
            </div>
          </div>
        </div>
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <svg width={ringSize} height={ringSize} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={ringSize/2} cy={ringSize/2} r={ringRadius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={ringStroke} />
            <circle cx={ringSize/2} cy={ringSize/2} r={ringRadius} fill="none" stroke="url(#progressGrad)" strokeWidth={ringStroke} strokeDasharray={ringCircum} strokeDashoffset={ringOffset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
            <defs><linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#34d399"/><stop offset="100%" stopColor="#3b82f6"/></linearGradient></defs>
          </svg>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
            <div style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>{pctAprobado}%</div>
            <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.5 }}>Avance</div>
          </div>
          <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', opacity: 0.6 }}>Progreso promedio: {avgProgress}%</div>
        </div>
      </div>

      {/* Countdown + ritmo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'white', borderRadius: 14, padding: '1.25rem', border: '1px solid #e2e8f0', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: diasRestantes <= 30 ? '#dc2626' : diasRestantes <= 90 ? '#d97706' : '#059669', letterSpacing: '-0.04em', lineHeight: 1 }}>{Math.abs(diasRestantes)}</div>
          <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '0.3rem' }}>{diasRestantes >= 0 ? 'Dias restantes' : 'Dias vencido'}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>Plazo: 12 mayo 2026</div>
        </div>
        <div style={{ background: 'white', borderRadius: 14, padding: '1.25rem', border: '1px solid #e2e8f0', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#1d4ed8', letterSpacing: '-0.04em', lineHeight: 1 }}>{regsPerMonth}</div>
          <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '0.3rem' }}>Reglamentos / mes</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>Ritmo necesario</div>
        </div>
        <div style={{ background: 'white', borderRadius: 14, padding: '1.25rem', border: '1px solid #e2e8f0', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#dc2626', letterSpacing: '-0.04em', lineHeight: 1 }}>{criticos}</div>
          <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '0.3rem' }}>En riesgo critico</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>Menos de 15% avance</div>
        </div>
        <div style={{ background: 'white', borderRadius: 14, padding: '1.25rem', border: '1px solid #e2e8f0', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#7c3aed', letterSpacing: '-0.04em', lineHeight: 1 }}>{enRevision + enProceso}</div>
          <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '0.3rem' }}>En tramitacion</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>{enRevision} revision + {enProceso} proceso</div>
        </div>
      </div>

      {/* Alertas legales */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ background: bannerClass === 'critical' ? 'linear-gradient(135deg, #fef2f2, #fff1f2)' : bannerClass === 'warning' ? 'linear-gradient(135deg, #fffbeb, #fef9c3)' : 'linear-gradient(135deg, #f0fdf4, #ecfdf5)', borderRadius: 14, padding: '1.25rem 1.5rem', border: bannerClass === 'critical' ? '1px solid #fecaca' : bannerClass === 'warning' ? '1px solid #fde68a' : '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: bannerClass === 'critical' ? '#fee2e2' : bannerClass === 'warning' ? '#fef3c7' : '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={bannerClass === 'critical' ? '#dc2626' : bannerClass === 'warning' ? '#d97706' : '#16a34a'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: bannerClass === 'critical' ? '#991b1b' : bannerClass === 'warning' ? '#92400e' : '#166534', marginBottom: '0.2rem' }}>Art. Primero Transitorio — Plazo General</div>
            <div style={{ fontSize: '0.82rem', color: bannerClass === 'critical' ? '#b91c1c' : bannerClass === 'warning' ? '#a16207' : '#15803d', lineHeight: 1.5 }}>
              Plazo maximo de <strong>12 meses</strong> desde constitucion del Consejo Superior. {diasRestantes > 0 ? `Quedan ${faltantes} reglamentos por aprobar.` : 'El plazo ha vencido.'}
            </div>
          </div>
        </div>

        {diasUnidades < 0 && (
          <div style={{ background: 'linear-gradient(135deg, #fef2f2, #fff1f2)', borderRadius: 14, padding: '1.25rem 1.5rem', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#991b1b', marginBottom: '0.2rem' }}>Art. Quinto Transitorio — Plazo Vencido</div>
              <div style={{ fontSize: '0.82rem', color: '#b91c1c', lineHeight: 1.5 }}>
                Normas de unidades academicas/administrativas. <strong>Vencido hace {Math.abs(diasUnidades)} dias.</strong> Afecta: Reglamento de Estructuras Academicas, Reglamento General de Facultades.
              </div>
            </div>
          </div>
        )}

        <div style={{ background: 'linear-gradient(135deg, #f0f9ff, #eff6ff)', borderRadius: 14, padding: '1.25rem 1.5rem', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e40af', marginBottom: '0.2rem' }}>Ley 21.790 — Estudiantes Cuidadores</div>
            <div style={{ fontSize: '0.82rem', color: '#1d4ed8', lineHeight: 1.5 }}>
              Publicada 19/01/2026. Art. 11: dictar normas internas. Superintendencia fiscalizara cumplimiento. Afecta reglamento N°29.
            </div>
          </div>
        </div>
      </div>

      {/* Grid de contenido */}
      <div className="charts-grid">
        {/* Desglose por estado */}
        <div className="chart-card">
          <div className="chart-card-title">Avance por Estado</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {[
              { label: 'Aprobados', count: aprobados, cls: 'aprobado', color: '#10b981' },
              { label: 'En Revision', count: enRevision, cls: 'en-revision', color: '#f59e0b' },
              { label: 'En Proceso', count: enProceso, cls: 'en-proceso', color: '#3b82f6' },
              { label: 'Pendientes', count: pendientes, cls: 'pendiente', color: '#94a3b8' }
            ].map(s => (
              <div key={s.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#475569' }}>{s.label}</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: s.color }}>{s.count}</span>
                </div>
                <div style={{ height: 8, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${total > 0 ? Math.max((s.count / total) * 100, 3) : 0}%`, background: `linear-gradient(90deg, ${s.color}cc, ${s.color})`, borderRadius: 99, transition: 'width 0.6s ease' }}></div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8' }}>
            <span>Promedio general</span>
            <span style={{ fontWeight: 700, color: '#475569' }}>{avgProgress}%</span>
          </div>
        </div>

        {/* Reglamentos en riesgo */}
        <div className="chart-card">
          <div className="chart-card-title">Reglamentos en Riesgo</div>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ flex: 1, background: '#fef2f2', borderRadius: 10, padding: '0.6rem 0.75rem', textAlign: 'center', border: '1px solid #fecaca' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626' }}>{criticos}</div>
              <div style={{ fontSize: '0.62rem', fontWeight: 600, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Criticos</div>
            </div>
            <div style={{ flex: 1, background: '#fffbeb', borderRadius: 10, padding: '0.6rem 0.75rem', textAlign: 'center', border: '1px solid #fde68a' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#d97706' }}>{medios}</div>
              <div style={{ fontSize: '0.62rem', fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Moderados</div>
            </div>
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {enRiesgo.slice(0, 10).map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.55rem 0', borderBottom: '1px solid #f8fafc' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: r.riskLevel === 'critical' ? '#ef4444' : r.riskLevel === 'warning' ? '#f59e0b' : '#10b981', flexShrink: 0 }}></div>
                <span style={{ fontSize: '0.78rem', color: '#1e293b', flex: 1, lineHeight: 1.3 }}>{r.numero ? `${r.numero}. ` : ''}{r.nombre}</span>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', flexShrink: 0, fontWeight: 600 }}>{r.progreso}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Carga por responsable */}
        <div className="chart-card">
          <div className="chart-card-title">Carga Pendiente por Responsable</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {topResponsables.map(([name, count], i) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `hsl(${220 + i * 30}, 60%, 95%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: `hsl(${220 + i * 30}, 60%, 45%)`, flexShrink: 0 }}>{name.charAt(0)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#1e293b', marginBottom: '0.2rem' }}>{name}</div>
                  <div style={{ height: 5, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${faltantes > 0 ? (count / faltantes) * 100 : 0}%`, background: `hsl(${220 + i * 30}, 60%, 55%)`, borderRadius: 99 }}></div>
                  </div>
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', minWidth: 20, textAlign: 'right' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Fundamento legal - Timeline */}
        <div className="chart-card">
          <div className="chart-card-title">Fundamento Legal</div>
          <div style={{ position: 'relative', paddingLeft: '1.5rem' }}>
            <div style={{ position: 'absolute', left: '0.45rem', top: 6, bottom: 6, width: 2, background: '#e2e8f0', borderRadius: 99 }}></div>
            {[
              { ref: '1° Trans.', title: 'Plazo general', text: '12 meses desde constitucion CS', date: '12 may 2026', color: diasRestantes <= 90 ? '#f59e0b' : '#3b82f6' },
              { ref: '2° Trans.', title: 'Consejo Superior', text: 'Constitucion en 9 meses', date: '12 may 2025', color: '#10b981' },
              { ref: '4° Trans.', title: 'Reglamentos vigentes', text: 'Mantienen vigencia si compatibles', date: '', color: '#94a3b8' },
              { ref: '5° Trans.', title: 'Unidades academicas', text: 'Normas internas en 12 meses', date: '12 ago 2025', color: diasUnidades < 0 ? '#ef4444' : '#3b82f6' },
              { ref: '6° Trans.', title: 'Nuevas estructuras', text: '1 ano desde CS constituido', date: '', color: '#8b5cf6' },
              { ref: 'Ley 21.790', title: 'Estudiantes cuidadores', text: 'Art. 11, normas internas', date: '19 ene 2026', color: '#0ea5e9' }
            ].map((item, i) => (
              <div key={item.ref} style={{ position: 'relative', paddingBottom: i < 5 ? '1rem' : 0, display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{ position: 'absolute', left: '-1.15rem', top: 4, width: 10, height: 10, borderRadius: '50%', background: item.color, border: '2px solid white', zIndex: 1 }}></div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '0.15rem 0.4rem', background: `${item.color}15`, color: item.color, borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{item.ref}</span>
                    {item.date && <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{item.date}</span>}
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b' }}>{item.title}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4 }}>{item.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
