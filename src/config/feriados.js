// Feriados legales de Chile usados para el cálculo de días hábiles administrativos.
//
// Ley 19.880 (art. 25): los plazos de días hábiles administrativos excluyen
// sábados, domingos y festivos. El Portal de Transparencia aplica este mismo
// criterio para los plazos de la Ley 20.285.
//
// ⚠ MANTENCIÓN: esta lista debe revisarse cada año. Los feriados movibles
// (Viernes Santo, San Pedro y San Pablo, Encuentro de Dos Mundos, Día de las
// Iglesias Evangélicas) y los feriados de elecciones cambian de fecha.
// Se pueden agregar feriados extra en tiempo de ejecución con `agregarFeriados()`
// (ver src/utils/fechas.js) sin tocar este archivo.

export const FERIADOS_CHILE = [
  // 2025
  '2025-01-01', '2025-04-18', '2025-04-19', '2025-05-01', '2025-05-21',
  '2025-06-20', '2025-06-29', '2025-07-16', '2025-08-15', '2025-09-18',
  '2025-09-19', '2025-10-12', '2025-10-31', '2025-11-01', '2025-11-16',
  '2025-12-08', '2025-12-14', '2025-12-25',
  // 2026
  '2026-01-01', '2026-04-03', '2026-04-04', '2026-05-01', '2026-05-21',
  '2026-06-21', '2026-06-29', '2026-07-16', '2026-08-15', '2026-09-18',
  '2026-09-19', '2026-10-12', '2026-10-31', '2026-11-01', '2026-12-08',
  '2026-12-25',
  // 2027
  '2027-01-01', '2027-03-26', '2027-03-27', '2027-05-01', '2027-05-21',
  '2027-06-21', '2027-06-29', '2027-07-16', '2027-08-15', '2027-09-18',
  '2027-09-19', '2027-10-11', '2027-10-31', '2027-11-01', '2027-12-08',
  '2027-12-25',
];
