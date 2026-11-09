import { CircuitBreaker } from './circuit-breaker.js';

describe('CircuitBreaker', () => {
  let reloj: number;
  let cambios: string[];
  let cb: CircuitBreaker;
  const ok = () => Promise.resolve('ok');
  const falla = () => Promise.reject(new Error('caído'));
  const fallar3Veces = async () => {
    for (let i = 0; i < 3; i++) await expect(cb.ejecutar(falla)).rejects.toThrow('caído');
  };

  beforeEach(() => {
    reloj = 0;
    cambios = [];
    cb = new CircuitBreaker(3, 10_000, (de, a) => cambios.push(`${de}->${a}`), () => reloj);
  });

  it('se abre con 3 fallos seguidos y deja de llamar', async () => {
    await fallar3Veces();
    const llamada = vi.fn(ok);
    await expect(cb.ejecutar(llamada)).rejects.toThrow('Circuito abierto');
    expect(llamada).not.toHaveBeenCalled();
  });

  it('a los 10 s deja pasar una prueba; si sale bien se cierra', async () => {
    await fallar3Veces();
    reloj = 10_000;
    await expect(cb.ejecutar(ok)).resolves.toBe('ok');
    expect(cambios).toEqual(['CERRADO->ABIERTO', 'ABIERTO->SEMIABIERTO', 'SEMIABIERTO->CERRADO']);
  });

  it('si la prueba falla vuelve a abierto', async () => {
    await fallar3Veces();
    reloj = 10_000;
    await expect(cb.ejecutar(falla)).rejects.toThrow('caído');
    expect(cambios.at(-1)).toBe('SEMIABIERTO->ABIERTO');
  });
});
