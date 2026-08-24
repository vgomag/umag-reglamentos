import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import Toast, { DURACION_MS } from './Toast';

/**
 * Lo que se prueba acá no es el componente sino el patrón con el que App lo
 * usa: un aviso por `key`. El temporizador del Toast arranca al montar y no se
 * reinicia, así que sin key React reutilizaba la instancia y un aviso que
 * llegaba a los 2,9 s del anterior heredaba los 0,1 s que quedaban.
 */

// Reproduce cómo App renderiza el aviso: montado condicionalmente y con o sin
// identidad propia, para poder comparar los dos comportamientos.
function Avisador({ conKey }) {
  const [aviso, setAviso] = useState(null);
  const [n, setN] = useState(0);

  const mostrar = (mensaje) => {
    setN(x => x + 1);
    setAviso({ mensaje, id: n + 1 });
  };

  return (
    <>
      <button onClick={() => mostrar('Primero')}>primero</button>
      <button onClick={() => mostrar('Segundo')}>segundo</button>
      {aviso && (
        <Toast
          key={conKey ? aviso.id : undefined}
          message={aviso.mensaje}
          type="success"
          onClose={() => setAviso(null)}
        />
      )}
    </>
  );
}

const avanzar = (ms) => act(() => { vi.advanceTimersByTime(ms); });
const clic = (nombre) => act(() => { screen.getByText(nombre).click(); });

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('Toast', () => {
  it('se cierra solo después de su duración', () => {
    render(<Avisador conKey />);
    clic('primero');
    expect(screen.getByText(/Primero/)).toBeTruthy();

    avanzar(DURACION_MS - 1);
    expect(screen.queryByText(/Primero/)).not.toBeNull();

    avanzar(1);
    expect(screen.queryByText(/Primero/)).toBeNull();
  });

  it('un aviso que llega encima del anterior dura lo suyo completo', () => {
    render(<Avisador conKey />);
    clic('primero');
    avanzar(DURACION_MS - 100);   // al primero le quedan 100 ms

    clic('segundo');
    avanzar(200);                  // el primero ya habría muerto

    expect(screen.queryByText(/Segundo/)).not.toBeNull();

    avanzar(DURACION_MS - 200);
    expect(screen.queryByText(/Segundo/)).toBeNull();
  });

  it('dos avisos con el mismo texto también son avisos distintos', () => {
    // Guardar dos veces seguidas da el mismo mensaje: sin identidad propia,
    // comparar los textos no habría bastado para reiniciar el temporizador.
    render(<Avisador conKey />);
    clic('primero');
    avanzar(DURACION_MS - 100);
    clic('primero');
    avanzar(200);

    expect(screen.queryByText(/Primero/)).not.toBeNull();
  });

  it('sin identidad propia el aviso hereda el tiempo del anterior', () => {
    // Documenta el defecto que se corrigió: es el mismo componente, sin `key`.
    render(<Avisador conKey={false} />);
    clic('primero');
    avanzar(DURACION_MS - 100);
    clic('segundo');
    avanzar(200);

    expect(screen.queryByText(/Segundo/)).toBeNull();
  });

  it('muestra el símbolo según el tipo', () => {
    render(<Toast message="Guardado" type="success" onClose={() => {}} />);
    expect(screen.getByText(/✓/)).toBeTruthy();
  });

  it('al desmontarse no deja el temporizador corriendo', () => {
    const onClose = vi.fn();
    const { unmount } = render(<Toast message="Guardado" type="success" onClose={onClose} />);

    unmount();
    avanzar(DURACION_MS * 2);

    expect(onClose).not.toHaveBeenCalled();
  });
});
