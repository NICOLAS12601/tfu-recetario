import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InventarioSoapClient, PreciosHttpClient } from './clientes-remotos.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { reintentar } from './reintentar.js';
import type {
  ItemListaDeCompras,
  ListaDeCompras,
} from './lista-de-compras.contract.js';

@Injectable()
export class ListaDeComprasService {
  private readonly logger = new Logger(ListaDeComprasService.name);
  // Caché del último precio conocido, en memoria de ESTE servicio.
  private readonly cachePrecios = new Map<string, number>();
  // CB_ENABLED=false lo apaga, para medir "solo timeout + retry".
  private readonly usarCircuitBreaker = process.env.CB_ENABLED !== 'false';
  // Se abre con 3 fallos seguidos; a los 10 s pasa a semiabierto.
  private readonly circuitoPrecios = new CircuitBreaker(3, 10_000, (de, a) =>
    this.logger.warn(`Circuit Breaker precios: ${de} -> ${a}`),
  );

  constructor(
    private readonly inventarioClient: InventarioSoapClient,
    private readonly preciosClient: PreciosHttpClient,
  ) {}

  /**
   * Orquesta Inventario (qué falta, por SOAP) + Precios (cuánto sale, por
   * REST) sin saber nada de cómo se cocina ni de cómo se calculan los
   * precios: solo consume las interfaces que exponen esos dos servicios.
   */
  async generar(recetaIds: string[]): Promise<ListaDeCompras> {
    const faltantesPorProducto = new Map<
      string,
      { nombre: string; cantidad: number }
    >();

    for (const recetaId of recetaIds) {
      const disponibilidad = await this.verificarDisponibilidad(recetaId);
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

    // Consulta agrupada: todos los faltantes en UNA llamada a Precios.
    const nombres = [...faltantesPorProducto.values()].map((f) => f.nombre);
    const precios = await this.obtenerPrecios(nombres);

    const items: ItemListaDeCompras[] = [];
    for (const [productoId, { nombre, cantidad }] of faltantesPorProducto) {
      // Fallback: si Precios no respondió, el último precio conocido.
      const precioUnitario = precios[nombre] ?? this.cachePrecios.get(nombre) ?? null;
      items.push({
        productoId,
        nombre,
        cantidad,
        precioUnitario,
        subtotal:
          precioUnitario === null
            ? null
            : Math.round(precioUnitario * cantidad * 100) / 100,
        estadoPrecio:
          precios[nombre] !== undefined
            ? 'actual'
            : precioUnitario !== null
              ? 'no actualizado'
              : 'no disponible',
      });
    }

    const total = Math.round(
      items.reduce((acc, item) => acc + (item.subtotal ?? 0), 0) * 100,
    ) / 100;

    return { recetaIds, items, total };
  }

  /**
   * Timeout (en el cliente) + 2 reintentos. El stock NO se cachea: si
   * Inventario no responde, no hay lista posible -> 503.
   */
  private async verificarDisponibilidad(recetaId: string) {
    try {
      return await reintentar(
        () => this.inventarioClient.verificarDisponibilidad(recetaId),
        (error) => !(error instanceof NotFoundException),
      );
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new ServiceUnavailableException(
        'Inventario y Recetas no responde: no se puede generar la lista de compras',
      );
    }
  }

  /**
   * Timeout + 2 reintentos, dentro del Circuit Breaker. Si falla o el
   * circuito está abierto devuelve {} y generar() usa la caché.
   */
  private async obtenerPrecios(nombres: string[]): Promise<Record<string, number>> {
    if (nombres.length === 0) return {};
    const llamar = () => reintentar(() => this.preciosClient.obtenerPrecios(nombres));
    try {
      const precios = this.usarCircuitBreaker
        ? await this.circuitoPrecios.ejecutar(llamar)
        : await llamar();
      for (const [nombre, precio] of Object.entries(precios)) {
        this.cachePrecios.set(nombre, precio);
      }
      return precios;
    } catch (error) {
      this.logger.warn(`Sin precios actuales, se usa la caché: ${(error as Error).message}`);
      return {};
    }
  }
}
