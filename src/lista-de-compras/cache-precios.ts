const EXPIRACION_MS = 60000;

export const cachePrecios = new Map();

setInterval(() => cachePrecios.clear(), EXPIRACION_MS);
