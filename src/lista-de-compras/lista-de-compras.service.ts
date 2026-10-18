import { Injectable } from '@nestjs/common';
import { RecetaService } from '../receta/receta.service.js';
import { ApiPreciosService } from '../api-precios/api-precios.service.js';
import { ConfiguracionService } from '../configuracion/configuracion.service.js';
import { CLAVES_DE_CONFIGURACION } from '../configuracion/configuracion.constants.js';
import { reintentar } from './reintentar.js';
import { guardarPrecioEnCache, leerPrecioCacheado } from './cache-precios.js';

import type {
  ItemListaDeCompras,
  ListaDeCompras,
} from './lista-de-compras.contract.js';

const INTENTOS_POR_DEFECTO = 3;
const ESPERA_POR_DEFECTO_MS = 100;
const CACHE_EXPIRACION_POR_DEFECTO_MS = 60000;

@Injectable()
export class ListaDeComprasService {
  constructor(
    private readonly recetaService: RecetaService,
    private readonly apiPreciosService: ApiPreciosService,
    private readonly configuracionService: ConfiguracionService,
  ) {}

  /**
   * Orquesta Receta (qué falta) + Api Precios (cuánto sale) sin saber nada
   * de cómo se cocina ni de cómo se calculan los precios: solo consume
   * las interfaces que exponen esos dos componentes.
   *
   * Sobre el precio de cada faltante aplica dos patrones:
   *  - cache-aside: primero busca en la caché local, y solo si no está
   *    llama al proveedor y guarda el resultado.
   *  - retry: ante una falla transitoria del proveedor, reintenta los
   *    intentos configurados antes de darse por vencido.
   */
  async generar(recetaIds: string[]): Promise<ListaDeCompras> {
    const faltantesPorProducto = new Map<
      string,
      { nombre: string; cantidad: number }
    >();

    for (const recetaId of recetaIds) {
      const disponibilidad =
        await this.recetaService.verificarDisponibilidad(recetaId);
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

    const intentosMaximos = this.configuracionService.getNumero(
      CLAVES_DE_CONFIGURACION.retryIntentos,
      INTENTOS_POR_DEFECTO,
    );
    const esperaMs = this.configuracionService.getNumero(
      CLAVES_DE_CONFIGURACION.retryEsperaMs,
      ESPERA_POR_DEFECTO_MS,
    );
    const cacheExpiracionMs = this.configuracionService.getNumero(
      CLAVES_DE_CONFIGURACION.cacheExpiracionMs,
      CACHE_EXPIRACION_POR_DEFECTO_MS,
    );

    const items: ItemListaDeCompras[] = [];
    for (const [productoId, { nombre, cantidad }] of faltantesPorProducto) {
      let precioUnitario = leerPrecioCacheado(nombre);
      if (precioUnitario === undefined) {
        precioUnitario = await reintentar(
          () => this.apiPreciosService.obtenerPrecio(nombre),
          intentosMaximos,
          esperaMs,
        );
        guardarPrecioEnCache(nombre, precioUnitario, cacheExpiracionMs);
      }

      items.push({
        productoId,
        nombre,
        cantidad,
        precioUnitario,
        subtotal: Math.round(precioUnitario * cantidad * 100) / 100,
      });
    }

    const total =
      Math.round(items.reduce((acc, item) => acc + item.subtotal, 0) * 100) /
      100;

    return { recetaIds, items, total };
  }
}
