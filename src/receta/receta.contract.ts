import type { Receta } from './receta.entity.js';

export interface IngredienteEstado {
  productoId: string;
  nombre: string;
  necesario: number;
  disponible: number;
  faltante: number;
}

export interface Disponibilidad {
  disponible: boolean;
  faltantes: IngredienteEstado[];
}

export interface DetalleReceta {
  id: string;
  nombre: string;
  disponible: boolean;
  ingredientes: IngredienteEstado[];
}

/**
 * Interfaz PROVISTA por el componente Receta.
 * La consume Lista de Compras (verificarDisponibilidad) para saber
 * qué falta comprar; obtenerDetalle la consume el propio controller
 * REST para mostrar la receta completa combinada con qué le falta.
 */
export interface IRecetaConsulta {
  listar(): Promise<Receta[]>;
  obtenerPorId(id: string): Promise<Receta>;
  obtenerDetalle(id: string): Promise<DetalleReceta>;
  verificarDisponibilidad(id: string): Promise<Disponibilidad>;
  cocinar(id: string): Promise<Receta>;
}
