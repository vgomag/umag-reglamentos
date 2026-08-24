import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * El Apps Script corre en Google, no aquí. Pero su parte más delicada —pasar
 * un convenio a fila plana y de vuelta— es JavaScript puro, así que se carga
 * el archivo con los servicios de Google simulados y se prueba de verdad.
 */
const codigo = fs.readFileSync(
  path.resolve(process.cwd(), 'google-apps-script/Codigo.gs'), 'utf-8');

const servicios = {
  Utilities: {
    formatDate: (fecha) => {
      const y = fecha.getFullYear();
      const m = String(fecha.getMonth() + 1).padStart(2, '0');
      const d = String(fecha.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    },
  },
  Session: { getScriptTimeZone: () => 'America/Santiago' },
  SpreadsheetApp: { getActiveSpreadsheet: () => { throw new Error('no usado en estas pruebas'); } },
  ContentService: { createTextOutput: () => ({ setMimeType: () => ({}) }), MimeType: { JSON: 'json' } },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
};

const exportar = `; return {
  encabezadosConvenios, encabezadosSolicitudes,
  filaAConvenio, convenioAFila, filaASolicitud, solicitudAFila,
  aTexto, aBooleano, UNIDADES
};`;

// eslint-disable-next-line no-new-func
const gs = new Function(...Object.keys(servicios), codigo + exportar)(...Object.values(servicios));

const CONVENIO = {
  id: 4,
  codigo: 'CONV-2026-004',
  nombre: 'Convenio de práctica profesional',
  unidadOrigen: 'Facultad de Ingeniería',
  contraparte: 'Municipalidad de Punta Arenas',
  tipo: 'Práctica profesional',
  fechaIngreso: '2026-02-10',
  fechaLimite: '2026-03-25',
  plazoEspecial: true,
  prioridad: 'alta',
  motivoPrioridad: 'Inicio del semestre',
  estado: 'En Tramitación',
  fechaEntregaRectoria: '',
  observaciones: 'Pendiente firma',
  etapas: [
    { unidad: 'VRAC', orden: 0, fechaInicio: '2026-02-12', fechaTermino: '2026-02-20', estado: 'Aprobado', observaciones: 'Sin objeciones' },
    { unidad: 'VRAF', orden: 3, fechaInicio: '2026-02-22', fechaTermino: '', estado: 'En Revisión', observaciones: '' },
  ],
};

describe('encabezados', () => {
  it('el orden de unidades coincide con el flujo por defecto de la app', () => {
    expect(gs.UNIDADES).toEqual(['VRAC', 'VRIIP', 'VVM', 'VRAF', 'PRO', 'CONTRALORIA', 'RECTORIA']);
  });

  it('genera 43 columnas: 14 de base, 28 de etapas y la marca de tiempo', () => {
    const cols = gs.encabezadosConvenios();
    expect(cols).toHaveLength(43);
    expect(cols[0]).toBe('id');
    expect(cols[cols.length - 1]).toBe('actualizado');
    expect(cols).toContain('VRAC_inicio');
    expect(cols).toContain('RECTORIA_observaciones');
  });

  it('los encabezados de solicitudes terminan en la marca de tiempo', () => {
    const cols = gs.encabezadosSolicitudes();
    expect(cols[0]).toBe('id');
    expect(cols).toContain('subsanacion_solicitada');
    expect(cols[cols.length - 1]).toBe('actualizado');
  });
});

describe('convenio → fila → convenio', () => {
  const encabezados = gs.encabezadosConvenios();

  it('conserva los campos base en el viaje de ida y vuelta', () => {
    const vuelta = gs.filaAConvenio(gs.convenioAFila(CONVENIO, encabezados), encabezados);
    expect(vuelta.id).toBe(4);
    expect(vuelta.nombre).toBe(CONVENIO.nombre);
    expect(vuelta.unidadOrigen).toBe(CONVENIO.unidadOrigen);
    expect(vuelta.fechaIngreso).toBe('2026-02-10');
    expect(vuelta.fechaLimite).toBe('2026-03-25');
    expect(vuelta.plazoEspecial).toBe(true);
    expect(vuelta.estado).toBe('En Tramitación');
  });

  it('conserva sólo las unidades que participan, con sus datos', () => {
    const vuelta = gs.filaAConvenio(gs.convenioAFila(CONVENIO, encabezados), encabezados);
    expect(vuelta.etapas.map(e => e.unidad)).toEqual(['VRAC', 'VRAF']);
    const vrac = vuelta.etapas.find(e => e.unidad === 'VRAC');
    expect(vrac.fechaInicio).toBe('2026-02-12');
    expect(vrac.fechaTermino).toBe('2026-02-20');
    expect(vrac.estado).toBe('Aprobado');
    expect(vrac.observaciones).toBe('Sin objeciones');
  });

  it('reasigna el orden de las etapas según el flujo de la planilla', () => {
    // VRAF es la cuarta del flujo: su orden vuelve como 3, no como venía.
    const vuelta = gs.filaAConvenio(gs.convenioAFila(CONVENIO, encabezados), encabezados);
    expect(vuelta.etapas.find(e => e.unidad === 'VRAF').orden).toBe(3);
    expect(vuelta.etapas.find(e => e.unidad === 'VRAC').orden).toBe(0);
  });

  it('deja vacías las columnas de las unidades que no participan', () => {
    const fila = gs.convenioAFila(CONVENIO, encabezados);
    const idx = encabezados.indexOf('CONTRALORIA_estado');
    expect(fila[idx]).toBe('');
  });

  it('una etapa con sólo observaciones sigue contando como participante', () => {
    const fila = gs.convenioAFila({
      ...CONVENIO,
      etapas: [{ unidad: 'PRO', orden: 4, fechaInicio: '', fechaTermino: '', estado: '', observaciones: 'En espera' }],
    }, encabezados);
    const vuelta = gs.filaAConvenio(fila, encabezados);
    expect(vuelta.etapas).toHaveLength(1);
    expect(vuelta.etapas[0].unidad).toBe('PRO');
    // Sin estado explícito se asume Pendiente.
    expect(vuelta.etapas[0].estado).toBe('Pendiente');
  });

  it('un convenio sin etapas vuelve sin etapas', () => {
    const vuelta = gs.filaAConvenio(gs.convenioAFila({ ...CONVENIO, etapas: [] }, encabezados), encabezados);
    expect(vuelta.etapas).toEqual([]);
  });

  it('escribe la marca de tiempo al guardar', () => {
    const fila = gs.convenioAFila(CONVENIO, encabezados);
    expect(fila[encabezados.indexOf('actualizado')]).toBeInstanceOf(Date);
  });

  it('convierte a texto las fechas que Sheets devuelve como Date', () => {
    const fila = gs.convenioAFila(CONVENIO, encabezados);
    fila[encabezados.indexOf('fecha_ingreso')] = new Date(2026, 1, 10, 12);
    expect(gs.filaAConvenio(fila, encabezados).fechaIngreso).toBe('2026-02-10');
  });

  it('no rompe si un campo opcional viene vacío', () => {
    const vuelta = gs.filaAConvenio(
      gs.convenioAFila({ id: 1, nombre: 'Mínimo', etapas: [] }, encabezados), encabezados);
    expect(vuelta.nombre).toBe('Mínimo');
    expect(vuelta.fechaLimite).toBe('');
    expect(vuelta.plazoEspecial).toBe(false);
  });
});

describe('solicitud → fila → solicitud', () => {
  const encabezados = gs.encabezadosSolicitudes();
  const SOLICITUD = {
    id: 2,
    codigo: 'UN016T0000633',
    fechaIngreso: '2026-01-26',
    solicitante: 'Persona solicitante',
    tipoPersona: 'Natural',
    email: 'correo@ejemplo.cl',
    telefono: '948596876',
    viaIngreso: 'Portal de Transparencia',
    materia: 'Copia del protocolo institucional',
    unidadDerivada: 'Prorrectoría',
    etapa: 'Análisis y búsqueda',
    estado: 'Prorrogada',
    prorrogada: true,
    fechaProrroga: '2026-02-20',
    subsanacionSolicitada: false,
    fechaSubsanacion: '',
    terceroInvolucrado: true,
    fechaRespuesta: '',
    causalReserva: '',
    formatoEntrega: 'Electrónico/PDF',
    medioEnvio: 'Correo electrónico',
    observaciones: '',
  };

  it('conserva los campos en el viaje de ida y vuelta', () => {
    const vuelta = gs.filaASolicitud(gs.solicitudAFila(SOLICITUD, encabezados), encabezados);
    expect(vuelta.id).toBe(2);
    expect(vuelta.codigo).toBe('UN016T0000633');
    expect(vuelta.materia).toBe(SOLICITUD.materia);
    expect(vuelta.fechaIngreso).toBe('2026-01-26');
  });

  it('conserva las tres banderas booleanas', () => {
    const vuelta = gs.filaASolicitud(gs.solicitudAFila(SOLICITUD, encabezados), encabezados);
    expect(vuelta.prorrogada).toBe(true);
    expect(vuelta.subsanacionSolicitada).toBe(false);
    expect(vuelta.terceroInvolucrado).toBe(true);
  });
});

describe('conversión de valores', () => {
  it('acepta las formas en que Sheets escribe un booleano', () => {
    ['TRUE', 'true', 'VERDADERO', 'Sí', 'si', '1', true].forEach(v => {
      expect(gs.aBooleano(v)).toBe(true);
    });
    ['FALSE', 'false', '', '0', 'no', null, undefined].forEach(v => {
      expect(gs.aBooleano(v)).toBe(false);
    });
  });

  it('trata los vacíos como cadena vacía, nunca como "null"', () => {
    expect(gs.aTexto(null)).toBe('');
    expect(gs.aTexto(undefined)).toBe('');
    expect(gs.aTexto('  espacios  ')).toBe('espacios');
  });
});

describe('control de acceso', () => {
  // verificarIdentidad llama a Google, así que se simula UrlFetchApp para
  // probar la lógica de autorización sin salir a la red.
  const cargarConAcceso = ({ respuestaGoogle, autorizados, clientId }) => {
    const servicios2 = {
      ...servicios,
      // verificarIdentidad calcula un hash del token para la clave de cache.
      Utilities: {
        ...servicios.Utilities,
        DigestAlgorithm: { SHA_256: 'SHA_256' },
        computeDigest: (_alg, texto) => Array.from(String(texto)).map(c => c.charCodeAt(0)),
        base64EncodeWebSafe: (bytes) => bytes.join('-'),
      },
      UrlFetchApp: {
        fetch: () => ({
          getResponseCode: () => respuestaGoogle.codigo,
          getContentText: () => JSON.stringify(respuestaGoogle.cuerpo || {}),
        }),
      },
      CacheService: { getScriptCache: () => ({ get: () => null, put() {} }) },
    };
    let fuente = codigo;
    if (autorizados !== undefined) {
      fuente = fuente.replace(/var USUARIOS_AUTORIZADOS = \[[\s\S]*?\];/,
        `var USUARIOS_AUTORIZADOS = ${JSON.stringify(autorizados)};`);
    }
    if (clientId !== undefined) {
      fuente = fuente.replace(/var CLIENT_ID = '[^']*';/, `var CLIENT_ID = '${clientId}';`);
    }
    // eslint-disable-next-line no-new-func
    return new Function(...Object.keys(servicios2),
      fuente + '; return { verificarIdentidad };')(...Object.values(servicios2));
  };

  const CLIENT = '123-abc.apps.googleusercontent.com';
  const okGoogle = (email, extra = {}) => ({
    codigo: 200,
    cuerpo: { aud: CLIENT, email, email_verified: 'true', ...extra },
  });

  it('deja pasar a una cuenta de la lista', () => {
    const gs2 = cargarConAcceso({
      respuestaGoogle: okGoogle('camilo@gmail.com'),
      autorizados: ['veronica@gmail.com', 'camilo@gmail.com'], clientId: CLIENT,
    });
    const r = gs2.verificarIdentidad('token');
    expect(r.ok).toBe(true);
    expect(r.email).toBe('camilo@gmail.com');
  });

  it('rechaza una cuenta que no está en la lista', () => {
    const gs2 = cargarConAcceso({
      respuestaGoogle: okGoogle('ajeno@gmail.com'),
      autorizados: ['veronica@gmail.com'], clientId: CLIENT,
    });
    const r = gs2.verificarIdentidad('token');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('no está autorizada');
  });

  it('no distingue mayúsculas ni espacios en los correos', () => {
    const gs2 = cargarConAcceso({
      respuestaGoogle: okGoogle('camilo@gmail.com'),
      autorizados: ['  Camilo@Gmail.com  '], clientId: CLIENT,
    });
    expect(gs2.verificarIdentidad('token').ok).toBe(true);
  });

  it('rechaza un token emitido para otra aplicación', () => {
    // Sin esta comprobación, un token de cualquier otro sitio con Google
    // serviría para entrar aquí.
    const gs2 = cargarConAcceso({
      respuestaGoogle: { codigo: 200, cuerpo: { aud: 'otra-app.apps.googleusercontent.com', email: 'camilo@gmail.com', email_verified: 'true' } },
      autorizados: ['camilo@gmail.com'], clientId: CLIENT,
    });
    const r = gs2.verificarIdentidad('token');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('no corresponde a esta aplicación');
  });

  it('rechaza una cuenta con el correo sin verificar', () => {
    const gs2 = cargarConAcceso({
      respuestaGoogle: okGoogle('camilo@gmail.com', { email_verified: 'false' }),
      autorizados: ['camilo@gmail.com'], clientId: CLIENT,
    });
    expect(gs2.verificarIdentidad('token').ok).toBe(false);
  });

  it('rechaza un token que Google no reconoce', () => {
    const gs2 = cargarConAcceso({
      respuestaGoogle: { codigo: 400, cuerpo: {} },
      autorizados: ['camilo@gmail.com'], clientId: CLIENT,
    });
    const r = gs2.verificarIdentidad('token');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('Sesión expirada');
  });

  it('rechaza cuando no se envía token', () => {
    const gs2 = cargarConAcceso({
      respuestaGoogle: okGoogle('camilo@gmail.com'),
      autorizados: ['camilo@gmail.com'], clientId: CLIENT,
    });
    expect(gs2.verificarIdentidad('').ok).toBe(false);
    expect(gs2.verificarIdentidad(null).ok).toBe(false);
  });

  it('con la lista vacía no entra nadie, y lo dice', () => {
    // Falla cerrado: ante una configuración incompleta, nadie pasa.
    const gs2 = cargarConAcceso({
      respuestaGoogle: okGoogle('camilo@gmail.com'), autorizados: [], clientId: CLIENT,
    });
    const r = gs2.verificarIdentidad('token');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('USUARIOS_AUTORIZADOS');
  });

  it('avisa si falta configurar el ID de cliente', () => {
    const gs2 = cargarConAcceso({
      respuestaGoogle: okGoogle('camilo@gmail.com'),
      autorizados: ['camilo@gmail.com'],
      clientId: 'PEGA-AQUI-TU-ID-DE-CLIENTE.apps.googleusercontent.com',
    });
    const r = gs2.verificarIdentidad('token');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('CLIENT_ID');
  });
});
