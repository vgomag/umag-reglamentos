/**
 * Sanitización y validación de texto para prevenir XSS y contenido malicioso.
 */

// Elimina tags HTML/scripts y caracteres peligrosos
export function sanitizeText(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')  // Remove script tags
    .replace(/<[^>]*>/g, '')                                // Remove all HTML tags
    .replace(/javascript:/gi, '')                           // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '')                             // Remove event handlers
    .trim();
}

// Sanitiza texto extraído de PDF (más agresivo)
export function sanitizePdfText(str) {
  if (!str || typeof str !== 'string') return '';
  return sanitizeText(str)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')  // Remove control characters
    .substring(0, 100000);  // Limit total length to prevent memory issues
}

// Valida que una URL sea segura
export function isValidUrl(url) {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

// Sanitiza un campo de texto simple (nombre, decreto, etc.)
export function sanitizeField(str, maxLength = 500) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').trim().substring(0, maxLength);
}
