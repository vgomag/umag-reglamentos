import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '123-abc.apps.googleusercontent.com');

const {
  googleConfigurado, leerToken, tokenVigente,
  guardarSesion, leerSesion, cerrarSesion, usuarioDeSesion,
} = await import('./auth');

// Arma un ID token de mentira con la misma forma que uno real (header.payload.firma).
function tokenFalso(payload) {
  const b64 = (obj) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'RS256' })}.${b64(payload)}.firma-no-verificada`;
}

const AHORA = 1_800_000_000;
const VALIDO = tokenFalso({
  email: 'camilo@gmail.com', name: 'Camilo Pérez',
  picture: 'https://ejemplo/foto.jpg', exp: AHORA + 3600,
});

beforeEach(() => { sessionStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('configuración', () => {
  it('se considera configurado cuando hay ID de cliente', () => {
    expect(googleConfigurado()).toBe(true);
  });
});

describe('lectura del token', () => {
  it('extrae correo, nombre y caducidad', () => {
    const datos = leerToken(VALIDO);
    expect(datos.email).toBe('camilo@gmail.com');
    expect(datos.nombre).toBe('Camilo Pérez');
    expect(datos.expira).toBe(AHORA + 3600);
  });

  it('decodifica correctamente los acentos', () => {
    const datos = leerToken(tokenFalso({ email: 'a@b.cl', name: 'María José Muñoz', exp: AHORA + 60 }));
    expect(datos.nombre).toBe('María José Muñoz');
  });

  it('usa el correo cuando no viene el nombre', () => {
    expect(leerToken(tokenFalso({ email: 'a@b.cl', exp: AHORA })).nombre).toBe('a@b.cl');
  });

  it('devuelve null ante cualquier cosa que no sea un token', () => {
    expect(leerToken('')).toBeNull();
    expect(leerToken(null)).toBeNull();
    expect(leerToken('no-es-un-jwt')).toBeNull();
    expect(leerToken('a.b')).toBeNull();
    expect(leerToken('a.$$$.c')).toBeNull();
  });
});

describe('vigencia', () => {
  it('acepta un token que aún no caduca', () => {
    expect(tokenVigente(VALIDO, AHORA)).toBe(true);
  });

  it('rechaza uno ya caducado', () => {
    expect(tokenVigente(tokenFalso({ email: 'a@b.cl', exp: AHORA - 10 }), AHORA)).toBe(false);
  });

  it('rechaza uno que caduca dentro del margen de seguridad', () => {
    // Menos de 60 s de vida: no alcanzaría a completar una petición.
    expect(tokenVigente(tokenFalso({ email: 'a@b.cl', exp: AHORA + 30 }), AHORA)).toBe(false);
  });

  it('rechaza uno sin caducidad', () => {
    expect(tokenVigente(tokenFalso({ email: 'a@b.cl' }), AHORA)).toBe(false);
  });
});

describe('sesión', () => {
  it('guarda y recupera un token vigente', () => {
    const futuro = tokenFalso({ email: 'v@gmail.com', exp: Math.floor(Date.now() / 1000) + 3600 });
    guardarSesion(futuro);
    expect(leerSesion()).toBe(futuro);
    expect(usuarioDeSesion().email).toBe('v@gmail.com');
  });

  it('descarta un token caducado en vez de devolverlo', () => {
    guardarSesion(tokenFalso({ email: 'v@gmail.com', exp: Math.floor(Date.now() / 1000) - 10 }));
    expect(leerSesion()).toBeNull();
    expect(usuarioDeSesion()).toBeNull();
  });

  it('cerrar sesión la borra', () => {
    guardarSesion(tokenFalso({ email: 'v@gmail.com', exp: Math.floor(Date.now() / 1000) + 3600 }));
    cerrarSesion();
    expect(leerSesion()).toBeNull();
  });

  it('no revienta si sessionStorage no está disponible', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() { throw new Error('bloqueado por el navegador'); },
    });
    expect(() => guardarSesion('x')).not.toThrow();
    expect(leerSesion()).toBeNull();
    expect(() => cerrarSesion()).not.toThrow();
    Object.defineProperty(window, 'sessionStorage', original);
  });
});
