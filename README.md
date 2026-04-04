# UMAG - Sistema de Seguimiento de Reglamentos

Sistema de seguimiento para la implementación de los nuevos estatutos de la Universidad de Magallanes.

## Características

- Dashboard con resumen de avance general
- Listado de 24 reglamentos precargados del nuevo estatuto
- Seguimiento de estado (Pendiente, En Proceso, En Revisión, Aprobado)
- Historial de cambios automático
- Adjuntos de archivos
- Plazos de implementación
- Exportación de datos en JSON
- Autenticación básica

## Despliegue en Netlify

1. Sube este repositorio a GitHub
2. Conecta el repositorio en [Netlify](https://app.netlify.com)
3. No se requiere comando de build - es un sitio estático
4. El directorio de publicación es `.` (raíz)

## Acceso

- Contraseña por defecto: `umag2026`
- Se puede cambiar en el código fuente (variable `AUTH_PASSWORD`)

## Tecnologías

- React 18 (CDN)
- React Router DOM (CDN)
- Babel Standalone (CDN)
- localStorage para persistencia de datos
- IndexedDB para archivos adjuntos
