import { Request, Response, NextFunction } from 'express';

const LIMITE_POR_MINUTO = 100;
const solicitudesPorCliente = new Map();

setInterval(() => solicitudesPorCliente.clear(), 60000);

export function limitarSolicitudes(req: Request, res: Response, next: NextFunction) {
  const cantidad = (solicitudesPorCliente.get(req.ip) || 0) + 1;
  solicitudesPorCliente.set(req.ip, cantidad);

  if (cantidad > LIMITE_POR_MINUTO) {
    res.status(429).json({ message: 'Demasiadas solicitudes' });
    return;
  }

  next();
}
