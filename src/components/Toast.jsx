import React, { useEffect, useRef } from 'react';

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

export default Toast;
