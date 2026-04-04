import React from 'react';

function DonutChart({ data, size = 140, strokeWidth = 20 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  let accumulated = 0;

  return (
    <svg className="donut-svg" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={center} cy={center} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
      {data.map((item, i) => {
        const dashLength = (item.value / 100) * circumference;
        const dashOffset = -(accumulated / 100) * circumference;
        accumulated += item.value;
        return (
          <circle key={i} cx={center} cy={center} r={radius} fill="none" stroke={item.color} strokeWidth={strokeWidth} strokeDasharray={`${dashLength} ${circumference - dashLength}`} strokeDashoffset={dashOffset} style={{ transition: 'all 0.5s ease' }} />
        );
      })}
      <text x={center} y={center - 6} textAnchor="middle" fontSize="1.5rem" fontWeight="700" fill="#0f172a" transform={`rotate(90, ${center}, ${center})`}>{Math.round(data.find(d => d.label === 'Aprobado')?.value || 0)}%</text>
      <text x={center} y={center + 12} textAnchor="middle" fontSize="0.6rem" fill="#64748b" transform={`rotate(90, ${center}, ${center})`}>aprobados</text>
    </svg>
  );
}

export default DonutChart;
