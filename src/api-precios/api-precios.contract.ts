/**
 * Interfaz PROVISTA por el componente Api Precios.
 * Simula una integración externa (por eso no tiene entidad/tabla propia).
 * La consume Lista de Compras para tasar lo que falta comprar.
 */
export interface IPrecioProvider {
  obtenerPrecio(nombreProducto: string): Promise<number>;
}
