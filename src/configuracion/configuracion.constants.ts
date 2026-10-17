/**
 * Claves y valores por defecto del External Configuration Store.
 *
 * Estos parámetros antes vivían como constantes repartidas en el código de
 * cada patrón (retry, rate limit, caché y falla simulada de precios). Ahora se
 * leen de la tabla `configuracion` para poder cambiarlos en caliente, sin
 * recompilar ni reiniciar la API.
 */
export const CLAVES_DE_CONFIGURACION = {
  retryIntentos: 'retry_intentos',
  retryEsperaMs: 'retry_espera_ms',
  rateLimitPorMinuto: 'rate_limit_por_minuto',
  cacheExpiracionMs: 'cache_expiracion_ms',
  precioProbabilidadFalla: 'precio_probabilidad_falla',
} as const;

export type ClaveDeConfiguracion =
  (typeof CLAVES_DE_CONFIGURACION)[keyof typeof CLAVES_DE_CONFIGURACION];

export const CONFIGURACION_POR_DEFECTO: Record<ClaveDeConfiguracion, string> = {
  [CLAVES_DE_CONFIGURACION.retryIntentos]: '3',
  [CLAVES_DE_CONFIGURACION.retryEsperaMs]: '100',
  [CLAVES_DE_CONFIGURACION.rateLimitPorMinuto]: '100',
  [CLAVES_DE_CONFIGURACION.cacheExpiracionMs]: '60000',
  [CLAVES_DE_CONFIGURACION.precioProbabilidadFalla]: '0.3',
};

/** Cada cuánto la API vuelve a leer la tabla para refrescar su copia local. */
export const INTERVALO_DE_REFRESCO_MS = 5000;
