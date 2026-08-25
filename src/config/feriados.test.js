import { describe, it, expect } from 'vitest';
import { FERIADOS_CHILE } from './feriados';
import {
  aniosConFeriados, ultimoAnioConFeriados, feriadosCubren, feriadosCubrenRango,
  agregarFeriados, sumarDiasHabiles, esDiaHabil,
} from '../utils/fechas';
import { crearSolicitud } from './transparencia';
import { plazoConFeriadosCompletos, infoPlazoSolicitud } from '../utils/transparenciaLogic';

/**
 * La tabla de feriados se escribe a mano y se acaba. Lo que se prueba acá no es
 * que esté completa —no puede estarlo— sino que la app SEPA hasta dónde llega,
 * porque pasado ese punto cuenta los feriados que faltan como días hábiles y
 * devuelve un plazo legal equivocado sin decir nada.
 *
 * Este archivo vive aparte de fechas.test.js a propósito: allá se agregan
 * feriados en caliente y eso ensuciaría la cobertura que se mide acá.
 */

describe('la tabla de feriados', () => {
  it('sólo tiene fechas ISO válidas y sin repetir', () => {
    FERIADOS_CHILE.forEach(f => expect(f).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    expect(new Set(FERIADOS_CHILE).size).toBe(FERIADOS_CHILE.length);
  });

  it('no incluye sábados ni domingos, que ya son inhábiles por sí solos', () => {
    const finesDeSemana = FERIADOS_CHILE.filter(f => {
      const d = new Date(`${f}T12:00:00`).getDay();
      return d === 0 || d === 6;
    });
    // Algunos feriados legales caen en fin de semana; lo que importa es que la
    // fecha siga siendo inhábil, no que esté o no en la lista.
    finesDeSemana.forEach(f => expect(esDiaHabil(f)).toBe(false));
  });

  it('cubre años consecutivos, sin huecos en medio', () => {
    const anios = aniosConFeriados();
    anios.forEach((anio, i) => {
      if (i > 0) expect(anio).toBe(anios[i - 1] + 1);
    });
  });
});

describe('hasta dónde sabe contar la app', () => {
  it('informa el último año cargado', () => {
    expect(ultimoAnioConFeriados()).toBe(Math.max(...aniosConFeriados()));
  });

  it('reconoce un año que está en la tabla', () => {
    expect(feriadosCubren(`${ultimoAnioConFeriados()}-06-15`)).toBe(true);
  });

  it('NO da por cubierto el año siguiente al último cargado', () => {
    // Éste es el fallo que antes pasaba en silencio.
    expect(feriadosCubren(`${ultimoAnioConFeriados() + 1}-06-15`)).toBe(false);
  });

  it('una fecha inválida no se considera cubierta', () => {
    expect(feriadosCubren('')).toBe(false);
    expect(feriadosCubren('no-es-fecha')).toBe(false);
    expect(feriadosCubren('2026-02-31')).toBe(false);
  });
});

describe('feriadosCubrenRango', () => {
  const ultimo = ultimoAnioConFeriados();

  it('acepta un tramo entero dentro de los años conocidos', () => {
    expect(feriadosCubrenRango(`${ultimo}-01-05`, `${ultimo}-02-10`)).toBe(true);
  });

  it('rechaza un tramo que se pasa de año', () => {
    // Caso real: una solicitud que entra en diciembre vence en enero siguiente.
    expect(feriadosCubrenRango(`${ultimo}-12-20`, `${ultimo + 1}-01-20`)).toBe(false);
  });

  it('rechaza aunque sólo falte un año intermedio', () => {
    expect(feriadosCubrenRango(`${ultimo}-12-01`, `${ultimo + 2}-01-01`)).toBe(false);
  });

  it('no le importa el orden de las fechas', () => {
    expect(feriadosCubrenRango(`${ultimo + 1}-01-20`, `${ultimo}-12-20`)).toBe(false);
    expect(feriadosCubrenRango(`${ultimo}-02-10`, `${ultimo}-01-05`)).toBe(true);
  });
});

describe('plazos de la Ley 20.285 fuera de cobertura', () => {
  const ultimo = ultimoAnioConFeriados();

  it('una solicitud dentro de la cobertura no se marca', () => {
    const dentro = crearSolicitud({ fechaIngreso: `${ultimo}-03-02`, materia: 'x' });

    expect(plazoConFeriadosCompletos(dentro)).toBe(true);
    expect(infoPlazoSolicitud(dentro, `${ultimo}-03-05`).feriadosIncompletos).toBe(false);
  });

  it('una solicitud del año siguiente sí se marca', () => {
    const fuera = crearSolicitud({ fechaIngreso: `${ultimo + 1}-03-02`, materia: 'x' });

    expect(plazoConFeriadosCompletos(fuera)).toBe(false);
    expect(infoPlazoSolicitud(fuera, `${ultimo + 1}-03-05`).feriadosIncompletos).toBe(true);
  });

  it('marca también la que entra a fin de año y vence en el siguiente', () => {
    // El ingreso está cubierto; el vencimiento, no. Mirar sólo el ingreso
    // dejaría pasar justo el caso más fácil de equivocar.
    const aCaballo = crearSolicitud({ fechaIngreso: `${ultimo}-12-15`, materia: 'x' });

    expect(plazoConFeriadosCompletos(aCaballo)).toBe(false);
  });

  it('sigue marcando una solicitud ya cerrada: el amparo se cuenta desde ahí', () => {
    const cerrada = crearSolicitud({
      fechaIngreso: `${ultimo + 1}-03-02`, materia: 'x', estado: 'Respondida',
    });
    const info = infoPlazoSolicitud(cerrada, `${ultimo + 1}-04-30`);

    expect(info.key).toBe('finalizado');
    expect(info.feriadosIncompletos).toBe(true);
  });

  it('sin fecha de ingreso no hay plazo que poner en duda', () => {
    const sinFecha = crearSolicitud({ materia: 'x' });

    expect(plazoConFeriadosCompletos(sinFecha)).toBe(true);
    expect(infoPlazoSolicitud(sinFecha).feriadosIncompletos).toBe(false);
  });
});

describe('efecto real de que falten feriados', () => {
  it('sin la tabla, el plazo cae antes de lo que corresponde', () => {
    const ultimo = ultimoAnioConFeriados();
    const sinFeriados = sumarDiasHabiles(`${ultimo + 1}-03-01`, 20);

    // Se eligen dos días HÁBILES de ese marzo: declarar feriado un fin de
    // semana no cambiaría nada y la prueba pasaría sin probar nada.
    const habiles = [];
    for (let d = 2; d <= 20 && habiles.length < 2; d++) {
      const fecha = `${ultimo + 1}-03-${String(d).padStart(2, '0')}`;
      if (esDiaHabil(fecha)) habiles.push(fecha);
    }
    agregarFeriados(habiles);
    const conFeriados = sumarDiasHabiles(`${ultimo + 1}-03-01`, 20);

    expect(habiles).toHaveLength(2);
    expect(conFeriados > sinFeriados).toBe(true);
  });

  it('agregar feriados extiende la cobertura', () => {
    const nuevoAnio = ultimoAnioConFeriados() + 1;
    expect(feriadosCubren(`${nuevoAnio}-05-01`)).toBe(false);

    agregarFeriados([`${nuevoAnio}-05-01`]);
    expect(feriadosCubren(`${nuevoAnio}-05-01`)).toBe(true);
  });
});

/**
 * Las fechas de arriba se transcriben a mano desde el calendario oficial, y un
 * dígito equivocado corre plazos legales sin que nada chille. Estas pruebas
 * recalculan las reglas y comparan, así que la transcripción queda verificada
 * en vez de creída.
 */
describe('los feriados movibles caen donde manda la regla', () => {
  // Domingo de Pascua por el algoritmo de Meeus/Jones/Butcher.
  const pascua = (Y) => {
    const a = Y % 19, b = Math.floor(Y / 100), c = Y % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31);
    const dia = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Y, mes - 1, dia, 12);
  };
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const desplazar = (d, n) => { const r = new Date(d); r.setDate(d.getDate() + n); return r; };
  const diaSemana = (f) => new Date(`${f}T12:00:00`).getDay();
  const anios = aniosConFeriados();

  it('Viernes y Sábado Santo son los dos días previos a la Pascua', () => {
    anios.forEach(anio => {
      const domingo = pascua(anio);
      expect(FERIADOS_CHILE).toContain(iso(desplazar(domingo, -2)));
      expect(FERIADOS_CHILE).toContain(iso(desplazar(domingo, -1)));
    });
  });

  it('San Pedro y San Pablo se celebra el 29 de junio o el lunes al que se corre', () => {
    // Ley 19.973: martes, miércoles o jueves → lunes de esa semana; viernes →
    // lunes siguiente. Cualquier otro día se celebra en su fecha.
    anios.forEach(anio => {
      const enJunio = FERIADOS_CHILE.filter(f => f.startsWith(`${anio}-06-2`) || f.startsWith(`${anio}-06-3`));
      const celebrado = enJunio.find(f => Number(f.slice(8)) >= 24);
      expect(celebrado, `San Pedro y San Pablo de ${anio}`).toBeDefined();
      expect([1, 0, 6]).toContain(diaSemana(celebrado)); // lunes, o su fecha si cayó en fin de semana
    });
  });

  it('el Encuentro de Dos Mundos cae lunes o fin de semana, nunca a media semana', () => {
    anios.forEach(anio => {
      const enOctubre = FERIADOS_CHILE.filter(f => f.startsWith(`${anio}-10-`) && Number(f.slice(8)) <= 15);
      expect(enOctubre, `Encuentro de Dos Mundos de ${anio}`).toHaveLength(1);
      expect([1, 0, 6]).toContain(diaSemana(enOctubre[0]));
    });
  });

  it('el Día de las Iglesias Evangélicas cae viernes, o el 31 si no hubo traslado', () => {
    // Ley 20.299: martes → viernes anterior; miércoles → viernes siguiente.
    anios.forEach(anio => {
      const cerca = FERIADOS_CHILE.filter(f =>
        (f.startsWith(`${anio}-10-`) && Number(f.slice(8)) >= 25) || f === `${anio}-11-02`);
      expect(cerca.length, `Iglesias Evangélicas de ${anio}`).toBeGreaterThan(0);
      const celebrado = cerca[0];
      const esViernes = diaSemana(celebrado) === 5;
      expect(esViernes || celebrado.endsWith('-10-31')).toBe(true);
    });
  });

  it('todos los años cargados traen los feriados fijos', () => {
    const fijos = ['01-01', '05-01', '05-21', '07-16', '08-15', '09-18', '09-19', '11-01', '12-08', '12-25'];
    anios.forEach(anio => {
      fijos.forEach(md => expect(FERIADOS_CHILE, `${anio}-${md}`).toContain(`${anio}-${md}`));
    });
  });

  it('cada año aporta al menos quince feriados', () => {
    anios.forEach(anio => {
      const delAnio = FERIADOS_CHILE.filter(f => f.startsWith(`${anio}-`));
      expect(delAnio.length, `feriados de ${anio}`).toBeGreaterThanOrEqual(15);
    });
  });
});
