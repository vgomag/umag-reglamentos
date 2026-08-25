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
//
// REGLAS DE TRASLADO, para poder comprobar lo que se agregue:
//   · San Pedro y San Pablo (29 jun) y Encuentro de Dos Mundos (12 oct):
//     si caen martes, miércoles o jueves se corren al lunes de esa semana;
//     si caen viernes, al lunes siguiente (Ley 19.973).
//   · Iglesias Evangélicas (31 oct): si cae martes se corre al viernes
//     anterior; si cae miércoles, al viernes siguiente (Ley 20.299).
//   · Viernes y Sábado Santo son los dos días previos al Domingo de Pascua.
//     feriados.test.js los recalcula y compara, así que un error de
//     transcripción en esas fechas rompe la suite.
//
// Los feriados de elecciones aparecen sólo cuando ya están fijados por ley
// (2025 tiene los suyos). Da igual para la cuenta —en Chile se vota en domingo,
// que ya es inhábil— y por eso los de 2028, todavía sin confirmar, se omiten:
// una fecha equivocada correría los plazos, una fecha ausente en domingo no.
// Si alguna vez se declarara una elección en día de semana, habría que anotarla.

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
  // 2027 — el 29 de junio cae martes: San Pedro y San Pablo se celebra el
  // lunes 28. Estuvo mal transcrito (como 29) hasta que la prueba de reglas
  // lo detectó; el 12 de octubre, martes también, sí estaba corrido al 11.
  '2027-01-01', '2027-03-26', '2027-03-27', '2027-05-01', '2027-05-21',
  '2027-06-21', '2027-06-28', '2027-07-16', '2027-08-15', '2027-09-18',
  '2027-09-19', '2027-10-11', '2027-10-31', '2027-11-01', '2027-12-08',
  '2027-12-25',
  // 2028 — los movibles van ya trasladados a la fecha en que se celebran:
  //   14 y 15 abr  Viernes y Sábado Santo (Pascua: domingo 16)
  //   20 jun       Pueblos Indígenas (solsticio de invierno, Ley 21.357)
  //   26 jun       San Pedro y San Pablo — el 29 cae jueves, se corre al lunes
  //    9 oct       Encuentro de Dos Mundos — el 12 cae jueves, se corre al lunes
  //   27 oct       Iglesias Evangélicas — el 31 cae martes, se corre al viernes anterior
  '2028-01-01', '2028-04-14', '2028-04-15', '2028-05-01', '2028-05-21',
  '2028-06-20', '2028-06-26', '2028-07-16', '2028-08-15', '2028-09-18',
  '2028-09-19', '2028-10-09', '2028-10-27', '2028-11-01', '2028-12-08',
  '2028-12-25',
];
