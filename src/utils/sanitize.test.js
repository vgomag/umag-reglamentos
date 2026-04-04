import { describe, it, expect } from 'vitest';
import { sanitizeText, sanitizePdfText, isValidUrl, sanitizeField } from './sanitize';

describe('sanitizeText', () => {
  it('remueve tags HTML', () => {
    expect(sanitizeText('<b>texto</b>')).toBe('texto');
    expect(sanitizeText('<script>alert("xss")</script>')).toBe('');
  });

  it('remueve javascript: protocol', () => {
    expect(sanitizeText('javascript:alert(1)')).toBe('alert(1)');
  });

  it('remueve event handlers', () => {
    expect(sanitizeText('onclick=doSomething()')).toBe('doSomething()');
  });

  it('retorna string vacío para null/undefined', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(undefined)).toBe('');
    expect(sanitizeText('')).toBe('');
  });

  it('preserva texto normal', () => {
    expect(sanitizeText('Reglamento de Facultades Art. 57')).toBe('Reglamento de Facultades Art. 57');
  });
});

describe('sanitizePdfText', () => {
  it('remueve caracteres de control', () => {
    expect(sanitizePdfText('texto\x00\x01normal')).toBe('textonormal');
  });

  it('limita longitud a 100000 caracteres', () => {
    const longText = 'a'.repeat(200000);
    expect(sanitizePdfText(longText).length).toBe(100000);
  });
});

describe('isValidUrl', () => {
  it('acepta URLs http y https', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://example.com/path')).toBe(true);
  });

  it('rechaza URLs con protocolos peligrosos', () => {
    expect(isValidUrl('javascript:alert(1)')).toBe(false);
    expect(isValidUrl('ftp://example.com')).toBe(false);
  });

  it('acepta valores vacíos', () => {
    expect(isValidUrl('')).toBe(true);
    expect(isValidUrl(null)).toBe(true);
  });

  it('rechaza strings no-URL', () => {
    expect(isValidUrl('no es url')).toBe(false);
  });
});

describe('sanitizeField', () => {
  it('remueve < y >', () => {
    expect(sanitizeField('texto <script>')).toBe('texto script');
  });

  it('respeta maxLength', () => {
    expect(sanitizeField('a'.repeat(600), 500).length).toBe(500);
  });

  it('hace trim', () => {
    expect(sanitizeField('  texto  ')).toBe('texto');
  });
});
