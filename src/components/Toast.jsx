import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

export const DURACION_MS = 3000;

/**
 * Aviso que se cierra solo.
 *
 * El temporizador arranca al montar y no se reinicia: App le pone una `key`
 * distinta a cada aviso justamente para que cada uno sea un montaje nuevo. Sin
 * esa key React reutilizaba la instancia, y un aviso que llegaba a los 2,9 s
 * del anterior heredaba los 0,1 s que le quedaban y pasaba sin verse.
 */
function Toast({ message, type, onClose }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const timer = setTimeout(() => onCloseRef.current(), DURACION_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`toast ${type}`}>
      {type === 'success' && '✓ '}
      {type === 'error' && '✕ '}
      {message}
    </div>
  );
}

Toast.propTypes = {
  message: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['success', 'error']).isRequired,
  onClose: PropTypes.func.isRequired,
};

export default Toast;
