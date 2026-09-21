import { Injectable } from '@nestjs/common';
import { RecetaService } from '../receta/receta.service.js';
import { ApiPreciosService } from '../api-precios/api-precios.service.js';
import type {
  ItemListaDeCompras,
  ListaDeCompras,
} from './lista-de-compras.contract.js';

@Injectable()
export class ListaDeComprasService {
  constructor(
    private readonly recetaService: RecetaService,
    private readonly apiPreciosService: ApiPreciosService,
  ) {}

  /**
   * Orquesta Receta (qué falta) + Api Precios (cuánto sale) sin saber nada
   * de cómo se cocina ni de cómo se calculan los precios: solo consume
   * las interfaces que exponen esos dos componentes.
   */
  async generar(recetaIds: string[]): Promise<ListaDeCompras> {
    const faltantesPorProducto = new Map<
      string,
      { nombre: string; cantidad: number }
    >();

    for (const recetaId of recetaIds) {
      const disponibilidad = await this.recetaService.verificarDisponibilidad(
        recetaId,
      );
      for (const faltante of disponibilidad.faltantes) {
        const existente = faltantesPorProducto.get(faltante.productoId);
        if (existente) {
          existente.cantidad += faltante.faltante;
        } else {
          faltantesPorProducto.set(faltante.productoId, {
            nombre: faltante.nombre,
            cantidad: faltante.faltante,
          });
        }
      }
    }

    const items: ItemListaDeCompras[] = [];
    for (const [productoId, { nombre, cantidad }] of faltantesPorProducto) {
      const precioUnitario = await this.apiPreciosService.obtenerPrecio(nombre);
      items.push({
        productoId,
        nombre,
        cantidad,
        precioUnitario,
        subtotal: Math.round(precioUnitario * cantidad * 100) / 100,
      });
    }

    const total = Math.round(
      items.reduce((acc, item) => acc + item.subtotal, 0) * 100,
    ) / 100;

    return { recetaIds, items, total };
  }
}
