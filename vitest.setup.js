import { configure } from '@testing-library/react';

// Las vistas se cargan con React.lazy y la planilla se simula con promesas, así
// que una aserción sobre la app completa encadena varios ciclos asíncronos.
// Con la suite corriendo en paralelo eso a veces pasaba del segundo que trae
// por defecto `waitFor`, y una prueba correcta fallaba una de cada dos veces.
//
// Un margen más ancho no esconde errores: si algo está roto la prueba falla
// igual, sólo que unos milisegundos después. Lo que evita es el rojo
// intermitente, que es lo que enseña a ignorar el rojo.
configure({ asyncUtilTimeout: 5000 });
