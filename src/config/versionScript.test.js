import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  VERSION_SCRIPT_ESPERADA, ESTADO_VERSION, compararVersionScript,
} from './versionScript';

/**
 * El Apps Script vive fuera del repositorio y fuera del despliegue de Netlify,
 * así que nada garantiza que lo publicado sea lo que hay acá. Esa comparación
 * es lo que se prueba en este archivo, empezando por la que nadie más puede
 * hacer: que los dos números estén sincronizados en el repositorio.
 */

const codigo = fs.readFileSync(
  path.resolve(process.cwd(), 'google-apps-script/Codigo.gs'), 'utf-8');

const versionDelScript = codigo.match(/var VERSION_SCRIPT = '([^']*)'/)?.[1];

describe('sincronización entre el script y la app', () => {
  it('Codigo.gs declara su versión', () => {
    expect(versionDelScript).toBeDefined();
    expect(versionDelScript).not.toBe('');
  });

  it('la versión del script y la que espera la app coinciden', () => {
    // Si esta prueba falla subiste una y te olvidaste de la otra. La app
    // avisaría de una desactualización que no existe, que es peor que no avisar.
    expect(VERSION_SCRIPT_ESPERADA).toBe(versionDelScript);
  });

  it('la versión es un entero, para poder saber cuál es más nueva', () => {
    expect(VERSION_SCRIPT_ESPERADA).toMatch(/^\d+$/);
  });
});

describe('compararVersionScript', () => {
  it('reconoce que lo publicado está al día', () => {
    const r = compararVersionScript('3', '3');

    expect(r.estado).toBe(ESTADO_VERSION.COINCIDE);
    expect(r.alDia).toBe(true);
    expect(r.mensaje).toContain('3');
  });

  it('detecta un script publicado más viejo que el repositorio', () => {
    // El caso real: se guardó el código en el editor pero no se publicó.
    const r = compararVersionScript('2', '3');

    expect(r.estado).toBe(ESTADO_VERSION.ANTIGUA);
    expect(r.alDia).toBe(false);
    expect(r.mensaje).toContain('Nueva versión');
  });

  it('detecta el caso inverso: el frontend quedó atrás', () => {
    const r = compararVersionScript('5', '3');

    expect(r.estado).toBe(ESTADO_VERSION.ADELANTADA);
    expect(r.alDia).toBe(false);
    expect(r.mensaje).toContain('desplegar el frontend');
  });

  it('un script que no informa versión es anterior a esta comprobación', () => {
    ['', null, undefined].forEach(sinVersion => {
      const r = compararVersionScript(sinVersion, '3');
      expect(r.estado).toBe(ESTADO_VERSION.SIN_VERSION);
      expect(r.alDia).toBe(false);
      expect(r.publicada).toBe('');
    });
  });

  it('acepta números además de texto', () => {
    expect(compararVersionScript(3, '3').alDia).toBe(true);
    expect(compararVersionScript(2, '3').estado).toBe(ESTADO_VERSION.ANTIGUA);
  });

  it('ignora espacios alrededor', () => {
    expect(compararVersionScript(' 3 ', '3').alDia).toBe(true);
  });

  it('con versiones no numéricas informa la diferencia sin inventar un orden', () => {
    const r = compararVersionScript('beta', '3');

    expect(r.alDia).toBe(false);
    expect(r.estado).toBe(ESTADO_VERSION.ANTIGUA);
    expect(r.publicada).toBe('beta');
  });

  it('sin argumento usa la versión que espera el repositorio', () => {
    expect(compararVersionScript(VERSION_SCRIPT_ESPERADA).alDia).toBe(true);
  });
});
