import type { EntityManager } from 'typeorm';
import type { Producto } from './producto.entity.js';

/**
 * Interfaz PROVISTA por el componente Producto.
 * La consumen Receta (para descontar stock al cocinar) y el propio
 * controller REST del módulo.
 */
export interface IProductoStock {
  listar(): Promise<Producto[]>;
  obtenerPorId(id: string): Promise<Producto>;
  consumirStock(id: string, cantidad: number): Promise<Producto>;
  consumirStockEnTransaccion(
    manager: EntityManager,
    id: string,
    cantidad: number,
  ): Promise<void>;
}
