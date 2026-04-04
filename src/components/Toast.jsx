import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

function Toast({ message, type, onClose }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const timer = setTimeout(() => onCloseRef.current(), 3000);
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
