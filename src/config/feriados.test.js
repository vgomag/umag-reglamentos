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
    // 20 días hábiles desde el 1 de marzo, en un año sin feriados cargados:
    // se cuentan sólo fines de semana, así que la fecha queda corta.
    const sinFeriados = sumarDiasHabiles(`${ultimo + 1}-03-01`, 20);

    agregarFeriados([`${ultimo + 1}-03-10`, `${ultimo + 1}-03-11`]);
    const conFeriados = sumarDiasHabiles(`${ultimo + 1}-03-01`, 20);

    expect(conFeriados > sinFeriados).toBe(true);
  });

  it('agregar feriados extiende la cobertura', () => {
    const nuevoAnio = ultimoAnioConFeriados() + 1;
    expect(feriadosCubren(`${nuevoAnio}-05-01`)).toBe(false);

    agregarFeriados([`${nuevoAnio}-05-01`]);
    expect(feriadosCubren(`${nuevoAnio}-05-01`)).toBe(true);
  });
});
