import React from 'react';
import DonutChart from '../components/DonutChart';

export default function Dashboard({ regulations }) {
  const approved = regulations.filter(r => r.estado === "Aprobado").length;
  const inProcess = regulations.filter(r => r.estado === "En Proceso").length;
  const inReview = regulations.filter(r => r.estado === "En Revisión").length;
  const pending = regulations.filter(r => r.estado === "Pendiente").length;
  const progress = Math.round((approved / regulations.length) * 100);

  const total = regulations.length;
  const statusData = [
    { label: "Pendiente", count: pending, pct: Math.round((pending / total) * 100), color: "#94a3b8", cls: "pendiente" },
    { label: "En Proceso", count: inProcess, pct: Math.round((inProcess / total) * 100), color: "#3b82f6", cls: "en-proceso" },
    { label: "En Revisión", count: inReview, pct: Math.round((inReview / total) * 100), color: "#f59e0b", cls: "en-revision" },
    { label: "Aprobado", count: approved, pct: Math.round((approved / total) * 100), color: "#10b981", cls: "aprobado" }
  ];

  const donutData = statusData.map(s => ({ label: s.label, value: s.pct, color: s.color }));

  const alta = regulations.filter(r => r.prioridad === "alta").length;
  const media = regulations.filter(r => r.prioridad === "media").length;
  const baja = regulations.filter(r => r.prioridad === "baja").length;
  const priorityData = [
    { label: "Alta", count: alta, pct: Math.round((alta / total) * 100), cls: "alta", color: "#ef4444" },
    { label: "Media", count: media, pct: Math.round((media / total) * 100), cls: "media", color: "#f59e0b" },
    { label: "Baja", count: baja, pct: Math.round((baja / total) * 100), cls: "baja", color: "#10b981" }
  ];

  const avgProgress = Math.round(regulations.reduce((sum, r) => sum + r.progreso, 0) / total);

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Estado general del proceso de reglamentos</p>
      </div>

      <div className="dashboard-grid">
        <div className="metric-card">
          <div className="metric-value">{total}</div>
          <div className="metric-label">Total de Reglamentos</div>
        </div>
        <div className="metric-card success">
          <div className="metric-value">{approved}</div>
          <div className="metric-label">Aprobados</div>
        </div>
        <div className="metric-card warning">
          <div className="metric-value">{inProcess + inReview}</div>
          <div className="metric-label">En Proceso / Revisión</div>
        </div>
        <div className="metric-card danger">
          <div className="metric-value">{pending}</div>
          <div className="metric-label">Pendientes</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{avgProgress}%</div>
          <div className="metric-label">Progreso Promedio</div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-card-title">Distribución por Estado</div>
          <div className="donut-container">
            <DonutChart data={donutData} />
            <div className="donut-legend">
              {statusData.map((s, i) => (
                <div key={i} className="donut-legend-item">
                  <div className="donut-legend-dot" style={{ backgroundColor: s.color }}></div>
                  <span>{s.label}: {s.count} ({s.pct}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-title">Avance por Estado</div>
          <div className="bar-chart">
            {statusData.map((s, i) => (
              <div key={i} className="bar-row">
                <div className="bar-label">{s.label}</div>
                <div className="bar-track">
                  <div className={`bar-fill ${s.cls}`} style={{ width: `${Math.max(s.pct, 8)}%` }}>
                    <span>{s.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-title">Distribución por Prioridad</div>
          <div className="bar-chart">
            {priorityData.map((p, i) => (
              <div key={i} className="bar-row">
                <div className="bar-label">{p.label}</div>
                <div className="bar-track">
                  <div className={`bar-fill ${p.cls}`} style={{ width: `${Math.max(p.pct, 8)}%` }}>
                    <span>{p.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-title">Progreso por Responsable</div>
          <div className="bar-chart">
            {(() => {
              const byResp = {};
              regulations.forEach(r => {
                if (!byResp[r.responsable]) byResp[r.responsable] = { total: 0, sum: 0 };
                byResp[r.responsable].total++;
                byResp[r.responsable].sum += r.progreso;
              });
              return Object.entries(byResp).sort((a, b) => (b[1].sum / b[1].total) - (a[1].sum / a[1].total)).map(([name, data], i) => {
                const avg = Math.round(data.sum / data.total);
                return (
                  <div key={i} className="bar-row">
                    <div className="bar-label" style={{ width: 110 }}>{name}</div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${Math.max(avg, 8)}%`, background: `linear-gradient(90deg, ${avg >= 75 ? '#34d399' : avg >= 40 ? '#60a5fa' : '#94a3b8'}, ${avg >= 75 ? '#10b981' : avg >= 40 ? '#3b82f6' : '#64748b'})` }}>
                        <span>{avg}%</span>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>N°</th>
              <th>Nombre</th>
              <th>Estado</th>
              <th>Progreso</th>
              <th>Responsable</th>
              <th>Prioridad</th>
            </tr>
          </thead>
          <tbody>
            {regulations.map(r => (
              <tr key={r.id}>
                <td>{r.numero}</td>
                <td>{r.nombre}</td>
                <td><span className={`badge ${r.estado.toLowerCase().replace(/\s+/g, '-')}`}>{r.estado}</span></td>
                <td>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${r.progreso}%` }}></div>
                  </div>
                  <div className="progress-text">{r.progreso}%</div>
                </td>
                <td>{r.responsable}</td>
                <td><span className={`badge ${r.prioridad}`}>{r.prioridad}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
