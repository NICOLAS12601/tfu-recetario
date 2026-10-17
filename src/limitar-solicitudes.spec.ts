import { crearLimitadorDeSolicitudes } from './limitar-solicitudes.js';
import { CLAVES_DE_CONFIGURACION } from './configuracion/configuracion.constants.js';
import type { ConfiguracionService } from './configuracion/configuracion.service.js';

function configuracionConLimite(limite: number): ConfiguracionService {
  return {
    getNumero: (clave: string, porDefecto: number) =>
      clave === CLAVES_DE_CONFIGURACION.rateLimitPorMinuto
        ? limite
        : porDefecto,
  } as unknown as ConfiguracionService;
}

/** Ejecuta el middleware y devuelve el status: 200 si llamó a next(), o el que responda. */
function pedir(
  middleware: ReturnType<typeof crearLimitadorDeSolicitudes>,
  ip: string,
  path = '/productos',
): Promise<number> {
  return new Promise((resolve) => {
    const res = {
      status(code: number) {
        resolve(code);
        return this;
      },
      json() {},
    };
    middleware({ ip, path } as never, res as never, () => resolve(200));
  });
}

describe('crearLimitadorDeSolicitudes', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('permite hasta el límite y a partir de ahí responde 429', async () => {
    const middleware = crearLimitadorDeSolicitudes(configuracionConLimite(3));

    expect(await pedir(middleware, '1.1.1.1')).toBe(200);
    expect(await pedir(middleware, '1.1.1.1')).toBe(200);
    expect(await pedir(middleware, '1.1.1.1')).toBe(200);
    expect(await pedir(middleware, '1.1.1.1')).toBe(429);
    expect(await pedir(middleware, '1.1.1.1')).toBe(429);
  });

  it('reinicia la ventana pasados 60 s (el cliente vuelve a estar habilitado)', async () => {
    const middleware = crearLimitadorDeSolicitudes(configuracionConLimite(3));

    for (let i = 0; i < 4; i++) {
      await pedir(middleware, '1.1.1.1');
    }
    expect(await pedir(middleware, '1.1.1.1')).toBe(429);

    vi.advanceTimersByTime(61_000);

    expect(await pedir(middleware, '1.1.1.1')).toBe(200);
  });

  it('cuenta por cliente: otro cliente no se ve afectado', async () => {
    const middleware = crearLimitadorDeSolicitudes(configuracionConLimite(1));

    expect(await pedir(middleware, '1.1.1.1')).toBe(200);
    expect(await pedir(middleware, '1.1.1.1')).toBe(429);
    expect(await pedir(middleware, '2.2.2.2')).toBe(200);
  });

  it('no limita las rutas de configuración (para no autobloquearse)', async () => {
    const middleware = crearLimitadorDeSolicitudes(configuracionConLimite(0));

    expect(await pedir(middleware, '1.1.1.1', '/configuracion')).toBe(200);
    expect(
      await pedir(middleware, '1.1.1.1', '/configuracion/retry_intentos'),
    ).toBe(200);
    expect(await pedir(middleware, '1.1.1.1')).toBe(429);
  });
});
