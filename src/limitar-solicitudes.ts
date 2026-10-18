import type { NextFunction, Request, Response } from 'express';
import { CLAVES_DE_CONFIGURACION } from './configuracion/configuracion.constants.js';
import type { ConfiguracionService } from './configuracion/configuracion.service.js';

const VENTANA_MS = 60000;
const LIMITE_POR_DEFECTO = 100;

/**
 * Rate limit (patrón de disponibilidad) como middleware de Express.
 *
 * El límite no es una constante: se lee del external configuration store en
 * cada request, así cambiarlo por la API tiene efecto inmediato. Se arma con
 * una fábrica porque necesita el ConfiguracionService inyectado, y main.ts lo
 * monta con `app.use()` una vez resuelto el contenedor de Nest.
 *
 * La ventana es por cliente (por IP): dentro de los 60 s se permiten hasta
 * `rate_limit_por_minuto` requests; a partir de ahí responde 429.
 *
 * Dos decisiones pensadas para no bloquear la administración:
 *  - `/configuracion` queda excluido, para no poder autobloquearse al cambiar
 *    el propio límite.
 *  - Si el valor configurado cambia, se reinicia el conteo, así el nuevo
 *    límite se aplica desde cero.
 */
export function crearLimitadorDeSolicitudes(
  configuracionService: ConfiguracionService,
) {
  const solicitudesPorCliente = new Map<string, number>();
  const inicioDeVentanaPorCliente = new Map<string, number>();
  let ultimoLimite: number | undefined;

  return function limitarSolicitudes(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    if (
      req.path === '/configuracion' ||
      req.path.startsWith('/configuracion/')
    ) {
      next();
      return;
    }

    const limite = configuracionService.getNumero(
      CLAVES_DE_CONFIGURACION.rateLimitPorMinuto,
      LIMITE_POR_DEFECTO,
    );

    if (limite !== ultimoLimite) {
      solicitudesPorCliente.clear();
      inicioDeVentanaPorCliente.clear();
      ultimoLimite = limite;
    }

    const cliente = req.ip ?? 'desconocido';
    const ahora = Date.now();

    // Registra el inicio de la ventana para un cliente nuevo y la reinicia una
    // vez vencida. Es clave guardar `ahora` acá: si sólo se leyera con `?? ahora`
    // sin persistirlo, la ventana nunca se reiniciaría y el cliente quedaría
    // bloqueado en 429 para siempre tras superar el límite una vez.
    const inicio = inicioDeVentanaPorCliente.get(cliente);
    if (inicio === undefined || ahora - inicio > VENTANA_MS) {
      inicioDeVentanaPorCliente.set(cliente, ahora);
      solicitudesPorCliente.set(cliente, 0);
    }

    const cantidad = (solicitudesPorCliente.get(cliente) ?? 0) + 1;
    solicitudesPorCliente.set(cliente, cantidad);

    if (cantidad > limite) {
      res.status(429).json({ message: 'Demasiadas solicitudes' });
      return;
    }

    next();
  };
}
