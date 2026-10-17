/**
 * Caché de precios (patrón cache-aside).
 *
 * Cada entrada guarda su propia expiración (TTL), que ahora sale del external
 * configuration store (`cache_expiracion_ms`). Antes había un setInterval que
 * vaciaba todo el Map cada 60 s con un TTL fijo en el código.
 */
interface EntradaDeCache {
  valor: number;
  expiraEn: number;
}

const cachePrecios = new Map<string, EntradaDeCache>();

export function leerPrecioCacheado(clave: string): number | undefined {
  const entrada = cachePrecios.get(clave);
  if (!entrada) {
    return undefined;
  }
  if (Date.now() > entrada.expiraEn) {
    cachePrecios.delete(clave);
    return undefined;
  }
  return entrada.valor;
}

export function guardarPrecioEnCache(
  clave: string,
  valor: number,
  ttlMs: number,
): void {
  // Un TTL <= 0 desactiva la caché: útil para observar el retry sin que la
  // caché tape las fallas simuladas.
  if (ttlMs <= 0) {
    return;
  }
  cachePrecios.set(clave, { valor, expiraEn: Date.now() + ttlMs });
}
